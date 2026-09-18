/** Actual SDK/config integration. Requires the repository's real dependencies. */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { config } from '../src/config.js';
import { McpLoader } from '../src/mcp/loader.js';
import { ProcessManager } from '../src/process.js';

async function fixture(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp boundary ')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = join(base, 'project'); await mkdir(project);
  return { base, project, catalog: join(base, 'catalog.json'), log: join(base, 'calls.txt'), profile: join(base, 'profile.json') };
}
const descriptor = (name = 'echo') => ({ name, description: 'echo text', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, annotations: { readOnlyHint: true } });

test('actual MCP file calls reject secrets, parent mutations and return ordinary source', async t => {
  const f = await fixture(t); const mcp = new McpLoader({}); const processes = new ProcessManager();
  const server = await createServer({ root: f.project, workspaces: { project: f.project }, defaultWorkspace: 'project',
    files: true, fileRead: true, fileWrite: true, shell: false, processes: false, port: 8787,
    skillsDir: join(f.base, 'skills'), mcpServers: {} }, mcp, [], processes);
  const client = new Client({ name: 'boundary-test', version: '1' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); await processes.close(); await mcp.close(); });
  await server.connect(serverSide); await client.connect(clientSide);
  await mkdir(join(f.project, 'bundle')); await writeFile(join(f.project, 'bundle', '.env'), 'FAKE_SECRET');
  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
  for (const [name, args] of [
    ['read_file', { path: 'bundle/.env' }], ['write_file', { path: 'bundle/.env', content: 'bad', overwrite: true }],
    ['delete_path', { path: 'bundle', recursive: true }], ['move_path', { from: 'bundle', to: 'exposed' }],
  ] as const) {
    const result = await call(name, args); assert.equal(result.isError, true); assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET/);
  }
  const search = await call('search_files', { query: 'FAKE_SECRET' }); assert.doesNotMatch(JSON.stringify(search), /FAKE_SECRET/);
  assert.equal(await readFile(join(f.project, 'bundle', '.env'), 'utf8'), 'FAKE_SECRET');
  assert.notEqual((await call('write_file', { path: 'ok.ts', content: 'export const n = 1;' })).isError, true);
  assert.match(JSON.stringify(await call('read_file', { path: 'ok.ts' })), /export const n/);
});

test('loader rejects every invalid grant before starting even an earlier valid child', async t => {
  const f = await fixture(t); const marker = join(f.base, 'must-not-exist');
  const mcp = new McpLoader({
    first: { command: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`], allowedTools: ['echo'] },
    second: { command: process.execPath },
  });
  t.after(() => mcp.close()); await assert.rejects(mcp.start(), /MCP_ALLOWLIST_REQUIRED/);
  await assert.rejects(access(marker), { code: 'ENOENT' });
});

test('real stdio MCP allowlist blocks unapproved calls before the child receives them', async t => {
  const f = await fixture(t); await writeFile(f.catalog, JSON.stringify([descriptor(), descriptor('hidden')]));
  const mcp = new McpLoader({ fixture: { command: process.execPath,
    args: [resolve('test/fixtures/policy-mcp-server.mjs'), f.catalog, f.log], allowedTools: ['echo'] } });
  t.after(() => mcp.close()); await mcp.start();
  assert.deepEqual((await mcp.listTools('fixture')).map(t => t.name), ['echo']);
  await assert.rejects(mcp.call('fixture', 'hidden', { text: 'x' }), /MCP_TOOL_DENIED/);
  await assert.rejects(access(f.log), { code: 'ENOENT' });
  await mcp.call('fixture', 'echo', { text: 'ok' }); assert.equal(await readFile(f.log, 'utf8'), 'echo\n');
});

test('observed schema drift clears the real loader cache and quarantines stale calls', async t => {
  const f = await fixture(t); await writeFile(f.catalog, JSON.stringify([descriptor()]));
  const mcp = new McpLoader({ fixture: { command: process.execPath,
    args: [resolve('test/fixtures/policy-mcp-server.mjs'), f.catalog, f.log], allowedTools: ['echo'] } });
  t.after(() => mcp.close()); await mcp.start();
  await writeFile(f.catalog, JSON.stringify([{ ...descriptor(), description: 'changed after discovery' }]));
  await assert.rejects(mcp.listTools('fixture'), /MCP_TOOL_CHANGED/);
  await assert.rejects(mcp.call('fixture', 'echo', { text: 'x' }), /MCP_TOOL_CHANGED/);
  await writeFile(f.catalog, JSON.stringify([descriptor()]));
  await assert.rejects(mcp.listTools('fixture'), /MCP_TOOL_CHANGED/);
  await assert.rejects(access(f.log), { code: 'ENOENT' });
});

test('actual config requires grants for enabled MCP servers but not disabled entries', async t => {
  const f = await fixture(t); const keys = ['LOCALMCP_CONFIG', 'LOCALMCP_ROOT', 'LOCALMCP_SHELL'];
  const prior = keys.map(k => [k, process.env[k]] as const);
  for (const key of keys) delete process.env[key]; process.env.LOCALMCP_CONFIG = f.profile;
  t.after(() => { for (const [key, value] of prior) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const save = (entry: unknown) => writeFile(f.profile, JSON.stringify({ root: f.project, mcpServers: { fixture: entry } }), { mode: 0o600 });
  await save({ command: process.execPath }); await assert.rejects(config(), /MCP_ALLOWLIST_REQUIRED/);
  await save({ command: process.execPath, enabled: false }); assert.deepEqual((await config()).mcpServers, {});
  await save({ command: process.execPath, allowedTools: ['echo'] });
  assert.deepEqual((await config()).mcpServers.fixture.allowedTools, ['echo']);
  await save({ command: process.execPath, allowedTools: ['*'] }); await assert.rejects(config(), /MCP_ALLOWLIST_REQUIRED/);
});
