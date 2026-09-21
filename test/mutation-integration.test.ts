/** Actual config/Zod/SDK tests. Requires the repository's installed dependencies. */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../src/config.js';
import { createServer } from '../src/server.js';
import { createToolRegistry } from '../src/modules/index.js';
import type { ModuleContext } from '../src/modules/context.js';
import { ProcessManager } from '../src/process.js';
import { McpLoader } from '../src/mcp/loader.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

async function fixture(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-mutation-sdk-')));
  const root = join(base, 'project'), profile = join(base, 'profile.json'); await mkdir(root);
  const content = JSON.stringify({ root, permissions: { fileRead: true, fileWrite: true } });
  await writeFile(profile, content, { mode: 0o600 }); await writeFile(join(root, 'a.txt'), 'a');
  const processes = new ProcessManager(), mcp = new McpLoader({}); await mcp.start();
  const cfg = await config({ path: profile, content });
  const context: ModuleContext = { config: cfg, processes, mcp, skills: [] };
  t.after(async () => { await processes.close(); await mcp.close(); await rm(base, { recursive: true, force: true }); });
  return { root, context, registry: createToolRegistry() };
}
const object = (v: unknown) => v as Record<string, unknown>;

test('real module keeps legacy read result and exposes version only when requested', async t => {
  const { context, registry } = await fixture(t);
  assert.deepEqual((await registry.call('read_file', { path: 'a.txt' }, context)).result, { path: 'a.txt', content: 'a' });
  const read = object((await registry.call('read_file', { path: 'a.txt', includeVersion: true }, context)).result);
  assert.match(String(read.sha256), /^[a-f0-9]{64}$/); assert.equal(read.bytes, 1); assert.equal(read.stamp, undefined);
});
test('permission revocation is checked before replay of an earlier successful operation', async t => {
  const { context, registry, root } = await fixture(t);
  const read = object((await registry.call('read_file', { path: 'a.txt', includeVersion: true }, context)).result);
  const args = { path: 'a.txt', oldText: 'a', newText: 'aa', expectedSha256: read.sha256, operationId: 'permission-op-01' };
  await registry.call('edit_file', args, context); context.config.fileWrite = false;
  await assert.rejects(registry.call('edit_file', args, context), /Unknown tool/);
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'aa');
});
test('real Zod rejects malformed IDs and hashes without changing the file', async t => {
  const { context, registry, root } = await fixture(t);
  for (const fields of [{ expectedSha256: 'bad' }, { operationId: 123 }, { operationId: 'bad/id/value' }]) {
    await assert.rejects(registry.call('edit_file', { path: 'a.txt', oldText: 'a', newText: 'aa', ...fields }, context));
  }
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'a');
});
test('real dispatcher rejects cross-tool operation ID reuse', async t => {
  const { context, registry } = await fixture(t);
  const read = object((await registry.call('read_file', { path: 'a.txt', includeVersion: true }, context)).result);
  await registry.call('edit_file', { path: 'a.txt', oldText: 'a', newText: 'aa', expectedSha256: read.sha256, operationId: 'cross-tool-01' }, context);
  await assert.rejects(registry.call('apply_patch', { path: 'a.txt', expectedSha256: read.sha256, operationId: 'cross-tool-01', edits: [{ startLine: 1, endLine: 1, replacement: 'aa' }] }, context), /OPERATION_ID_CONFLICT/);
});
test('installed MCP SDK preserves guarded edit receipts and stale-hash errors', async t => {
  const { context, root } = await fixture(t);
  const server = await createServer(context.config, context.mcp, context.skills, context.processes);
  const client = new Client({ name: 'mutation-sdk', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  const unpack = (result: unknown) => JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
  const version = unpack(await call('read_file', { path: 'a.txt', includeVersion: true }));
  const args = { path: 'a.txt', oldText: 'a', newText: 'aa', expectedSha256: version.sha256, operationId: 'sdk-roundtrip-01' };
  assert.equal(unpack(await call('edit_file', args)).replayed, false);
  assert.equal(unpack(await call('edit_file', args)).replayed, true);
  assert.equal((await call('edit_file', { ...args, operationId: 'sdk-stale-02' })).isError, true);
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'aa');
});
