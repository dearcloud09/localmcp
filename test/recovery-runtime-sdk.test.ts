/** Real config/Zod/MCP SDK checks. No protocol substitutes. Requires the full checkout and pinned dependencies. */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config, type Config } from '../src/config.js';
import { createServer } from '../src/server.js';
import { ProcessManager } from '../src/process.js';
import { McpLoader } from '../src/mcp/loader.js';
import { RuntimeMutations, initializeRecovery } from '../src/core/mutation-runtime.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

async function setup(t: TestContext, initialize = true) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-recovery-sdk-')));
  const project = join(base, 'project'); await mkdir(project, { mode: 0o700 });
  const profile = join(base, 'profile.json'); const directory = join(base, 'journal');
  const raw = { root: project, permissions: { fileRead: true, fileWrite: true }, recovery: { mode: 'durable', directory } };
  const content = JSON.stringify(raw); await writeFile(profile, content, { mode: 0o600 });
  await writeFile(join(project, 'a.txt'), 'a');
  const cfg = await config({ path: profile, content });
  if (initialize) await initializeRecovery(cfg);
  const mcp = new McpLoader({}); await mcp.start(); const processes = new ProcessManager();
  t.after(async () => { await processes.close(); await mcp.close(); await rm(base, { recursive: true, force: true }); });
  const connect = async (runtime?: { config: Config; mcp: McpLoader; skills: []; mutations: RuntimeMutations }) => {
    const server = await createServer(cfg, mcp, [], processes, runtime ? () => runtime : undefined);
    const client = new Client({ name: 'recovery-sdk-test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
    return { client, server, close: async () => { await client.close(); await server.close(); } };
  };
  return { base, project, profile, directory, raw, cfg, mcp, processes, connect };
}
const unpack = (value: unknown): Record<string, unknown> => JSON.parse((value as { content: Array<{ text: string }> }).content[0].text);
const call = (client: Client, name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });

test('real config validates recovery without creating it and createServer rejects missing ledger', async t => {
  const f = await setup(t, false); assert.equal(f.cfg.recovery?.mode, 'durable');
  await assert.rejects(lstat(f.directory), { code: 'ENOENT' });
  await assert.rejects(f.connect(), /JOURNAL_NOT_INITIALIZED/);
  await assert.rejects(lstat(f.directory), { code: 'ENOENT' });
});
test('real config rejects malformed recovery and overlap before namespace creation', async t => {
  const f = await setup(t, false);
  for (const recovery of [null, { mode: 'durable', directory: f.directory, reset: true }, { mode: 'durable', directory: join(f.project, 'ledger') }]) {
    await assert.rejects(config({ path: f.profile, content: JSON.stringify({ ...f.raw, recovery }) }));
  }
  await assert.rejects(lstat(f.directory), { code: 'ENOENT' });
});
test('installed SDK guarded edit survives protocol server re-creation with historical receipt', async t => {
  const f = await setup(t); const first = await f.connect();
  const version = unpack(await call(first.client, 'read_file', { path: 'a.txt', includeVersion: true }));
  const args = { path: 'a.txt', oldText: 'a', newText: 'aa', expectedSha256: version.sha256, operationId: 'sdk-recovery-0001' };
  assert.equal(unpack(await call(first.client, 'edit_file', args)).replayed, false); await first.close();
  await writeFile(join(f.project, 'a.txt'), 'later external version');
  const second = await f.connect(); t.after(second.close);
  assert.equal(unpack(await call(second.client, 'edit_file', args)).replayed, true);
  assert.equal(await readFile(join(f.project, 'a.txt'), 'utf8'), 'later external version');
});
test('installed SDK per-call permission snapshot denies cached successful replay', async t => {
  const f = await setup(t); const mutations = await RuntimeMutations.open(f.cfg);
  const runtime = { config: f.cfg, mcp: f.mcp, skills: [] as [], mutations };
  const connection = await f.connect(runtime); t.after(connection.close);
  const version = unpack(await call(connection.client, 'read_file', { path: 'a.txt', includeVersion: true }));
  const args = { path: 'a.txt', oldText: 'a', newText: 'aa', expectedSha256: version.sha256, operationId: 'sdk-permission-0001' };
  assert.equal(unpack(await call(connection.client, 'edit_file', args)).replayed, false);
  runtime.config = { ...f.cfg, fileWrite: false };
  assert.equal((await call(connection.client, 'edit_file', args)).isError, true);
  assert.ok(!(await connection.client.listTools()).tools.some(t => t.name === 'edit_file'));
  runtime.config = f.cfg;
  assert.equal(unpack(await call(connection.client, 'edit_file', args)).replayed, true);
});
test('installed SDK guards incompatible recovery snapshots instead of silently falling back', async t => {
  const f = await setup(t); const mutations = await RuntimeMutations.open(f.cfg);
  const runtime = { config: f.cfg, mcp: f.mcp, skills: [] as [], mutations };
  const connection = await f.connect(runtime); t.after(connection.close);
  runtime.config = { ...f.cfg, recovery: { mode: 'memory' } };
  const rejected = await call(connection.client, 'read_file', { path: 'a.txt' });
  assert.equal(rejected.isError, true); assert.match(JSON.stringify(rejected), /RECOVERY_RESTART_REQUIRED/);
  runtime.config = f.cfg;
  assert.equal(unpack(await call(connection.client, 'read_file', { path: 'a.txt' })).content, 'a');
});
test('workspace_info advertises journal scope without its storage path', async t => {
  const f = await setup(t); const connection = await f.connect(); t.after(connection.close);
  const info = unpack(await call(connection.client, 'workspace_info', {}));
  const recovery = info.mutationRecovery as Record<string, unknown>;
  assert.equal(recovery.mode, 'durable'); assert.equal(recovery.restartPersistent, true);
  assert.equal(recovery.atomicFileAndJournal, false); assert.ok(!JSON.stringify(recovery).includes(f.base));
});
test('edit request fields cannot change the configured durable backend', async t => {
  const f = await setup(t); const first = await f.connect();
  const version = unpack(await call(first.client, 'read_file', { path: 'a.txt', includeVersion: true }));
  const args = { path: 'a.txt', oldText: 'a', newText: 'aa', operationId: 'sdk-inject-0001', expectedSha256: version.sha256, recovery: { mode: 'memory' } };
  assert.equal(unpack(await call(first.client, 'edit_file', args)).replayed, false);
  await first.close();
  const second = await f.connect(); t.after(second.close);
  assert.equal(unpack(await call(second.client, 'edit_file', args)).replayed, true);
  assert.equal(await readFile(join(f.project, 'a.txt'), 'utf8'), 'aa');
});
