/** Real SDK/config coverage. Requires installed dependencies, no Docker daemon for these tests. */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../src/config.js';
import { createToolRegistry } from '../src/modules/index.js';
import { McpLoader } from '../src/mcp/loader.js';
import { ProcessManager } from '../src/process.js';
import { createServer } from '../src/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const check = { image: `sha256:${'a'.repeat(64)}`, executable: '/usr/local/bin/node', args: ['--test'] };
async function fixture(t: TestContext, extra: Record<string, unknown> = {}) {
  const base = await mkdtemp(join(tmpdir(), 'checks-integration-')), project = join(base, 'project'), path = join(base, 'config.json');
  await mkdir(project); await writeFile(path, JSON.stringify({ root: project, ...extra }), { mode: 0o600 });
  const keys = ['LOCALMCP_CONFIG', 'LOCALMCP_ROOT', 'LOCALMCP_SHELL', 'LOCALMCP_PORT']; const previous = keys.map(k => [k, process.env[k]]);
  for (const key of keys) delete process.env[key]; process.env.LOCALMCP_CONFIG = path;
  const mcp = new McpLoader({}), processes = new ProcessManager(); await mcp.start();
  t.after(async () => { await mcp.close(); await processes.close(); await rm(base, { recursive: true, force: true }); for (const [key, value] of previous) { if (value === undefined) delete process.env[key!]; else process.env[key!] = value; } });
  return { path, context: { config: await config(), mcp, processes, skills: [] } };
}
test('default config never exposes run_check or enables legacy shell', async t => {
  const { context } = await fixture(t); const names = createToolRegistry().list(context).map(x => x.name);
  assert.equal(context.config.sandboxChecks, false); assert.equal(context.config.shell, false); assert.ok(!names.includes('run_check'));
});
test('operator-configured checks are available with legacy shell disabled', async t => {
  const { context } = await fixture(t, { checks: { test: check } });
  assert.equal(context.config.sandboxChecks, true); assert.equal(context.config.shell, false);
  const names = createToolRegistry().list(context).map(x => x.name); assert.ok(names.includes('run_check')); assert.ok(!names.includes('run_command'));
});
test('unknown check names are rejected before any Docker execution', async t => {
  const { context } = await fixture(t, { checks: { test: check } });
  await assert.rejects(createToolRegistry().call('run_check', { check: 'not-configured' }, context), /Unknown configured check/);
});
test('disabled file reads deny both discovery and direct isolated check calls', async t => {
  const { context } = await fixture(t, { permissions: { fileRead: false }, checks: { test: check } });
  const registry = createToolRegistry(); assert.ok(!registry.list(context).some(x => x.name === 'run_check'));
  await assert.rejects(registry.call('run_check', { check: 'test' }, context));
});
test('actual config rejects mutable tags and shell-like executable strings', async t => {
  const { path } = await fixture(t); const original = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8'));
  for (const value of [{ ...check, image: 'node:latest' }, { ...check, executable: '/bin/node;whoami' }]) {
    await writeFile(path, JSON.stringify({ ...original, checks: { test: value } })); await assert.rejects(config());
  }
});
test('actual SDK returns a denied call when isolated checks are not configured', async t => {
  const { context } = await fixture(t); const server = await createServer(context.config, context.mcp, context.skills, context.processes);
  const client = new Client({ name: 'checks-integration', version: '1' }); const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); }); await server.connect(b); await client.connect(a);
  const result = await client.callTool({ name: 'run_check', arguments: { check: 'test' } }); assert.equal(result.isError, true);
});
