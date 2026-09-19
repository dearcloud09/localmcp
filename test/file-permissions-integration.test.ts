/** Requires the real upstream dependencies and a fresh build; not an offline SDK substitute. */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config, localMcpConfigSchema } from '../src/config.js';
import { createServer } from '../src/server.js';
import { createToolRegistry } from '../src/modules/index.js';
import type { ModuleContext } from '../src/modules/context.js';
import { ProcessManager } from '../src/process.js';
import { McpLoader } from '../src/mcp/loader.js';

const READ_NAMES = ['list_directory', 'workspace_tree', 'stat_path', 'find_files', 'search_files', 'read_file', 'read_file_lines'];
const WRITE_CALLS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['write_file', { path: 'note.txt', content: 'changed', overwrite: true }],
  ['edit_file', { path: 'note.txt', oldText: 'before', newText: 'changed' }],
  ['apply_patch', { path: 'note.txt', edits: [{ startLine: 1, endLine: 1, replacement: 'changed' }] }],
  ['create_directory', { path: 'created' }], ['delete_path', { path: 'note.txt' }],
  ['move_path', { from: 'note.txt', to: 'moved.txt' }],
];
async function fixture(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'file-permission-sdk-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'project'), home = join(base, 'home');
  await mkdir(root); await mkdir(home); await writeFile(join(root, 'note.txt'), 'before');
  const profile = join(base, 'profile.json');
  const processes = new ProcessManager(); const mcp = new McpLoader({}); await mcp.start();
  t.after(async () => { await processes.close(); await mcp.close(); });
  const context: ModuleContext = { config: { root, workspaces: { project: root }, defaultWorkspace: 'project', files: true, fileRead: true, fileWrite: false, shell: false, processes: false, port: 8787, skillsDir: join(base, 'skills'), enabledSkills: [], mcpServers: {}, configFile: profile }, processes, mcp, skills: [] };
  return { base, root, home, profile, context };
}
test('real file module hides and denies every mutation with no filesystem changes', async t => {
  const f = await fixture(t); const registry = createToolRegistry();
  assert.equal(registry.list(f.context).length, 14);
  for (const [name, args] of WRITE_CALLS) {
    assert.ok(!registry.list(f.context).some(tool => tool.name === name));
    await assert.rejects(registry.call(name, args, f.context), /Unknown tool/);
    assert.equal(await readFile(join(f.root, 'note.txt'), 'utf8'), 'before');
    assert.deepEqual(await readdir(f.root), ['note.txt']);
  }
  assert.deepEqual((await registry.call('read_file', { path: 'note.txt' }, f.context)).result, { path: 'note.txt', content: 'before' });
});
test('disabled reads hide all file tools and metadata reports scoped permissions', async t => {
  const f = await fixture(t); const registry = createToolRegistry(); f.context.config.fileRead = false;
  const files = registry.list(f.context).filter(tool => [...READ_NAMES, ...WRITE_CALLS.map(([name]) => name)].includes(tool.name));
  assert.equal(files.length, 0);
  for (const name of READ_NAMES) await assert.rejects(registry.call(name, {}, f.context), /Unknown tool/);
  const info = (await registry.call('workspace_info', {}, f.context)).result as { filePermissions: unknown };
  assert.deepEqual(info.filePermissions, { read: false, write: false, scope: 'file-tools' });
});
test('explicit opt-in restores all six existing mutations', async t => {
  const f = await fixture(t); f.context.config.fileWrite = true; const registry = createToolRegistry();
  assert.equal(registry.list(f.context).length, 20);
  await registry.call('write_file', { path: 'note.txt', content: 'one', overwrite: true }, f.context);
  await registry.call('edit_file', { path: 'note.txt', oldText: 'one', newText: 'two' }, f.context);
  await registry.call('apply_patch', { path: 'note.txt', edits: [{ startLine: 1, endLine: 1, replacement: 'three' }] }, f.context);
  await registry.call('create_directory', { path: 'dir' }, f.context);
  await registry.call('move_path', { from: 'note.txt', to: 'dir/note.txt' }, f.context);
  assert.equal(await readFile(join(f.root, 'dir/note.txt'), 'utf8'), 'three');
  await registry.call('delete_path', { path: 'dir/note.txt' }, f.context);
  assert.deepEqual(await readdir(join(f.root, 'dir')), []);
});
test('real SDK returns isError for denied writes and preserves successful read results', async t => {
  const f = await fixture(t); const server = await createServer(f.context.config, f.context.mcp, [], f.context.processes);
  const client = new Client({ name: 'permission-sdk', version: '1' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(st); await client.connect(ct);
  for (const [name, args] of WRITE_CALLS) assert.equal((await client.callTool({ name, arguments: args })).isError, true);
  const read = await client.callTool({ name: 'read_file', arguments: { path: 'note.txt' } });
  assert.notEqual(read.isError, true); assert.deepEqual(read.content, [{ type: 'text', text: JSON.stringify({ path: 'note.txt', content: 'before' }) }]);
  assert.deepEqual(await readdir(f.root), ['note.txt']);
});
test('real config loader defaults read-only and validates opt-in and malformed policies', async t => {
  const f = await fixture(t); await writeFile(f.profile, JSON.stringify({ root: f.root }), { mode: 0o600 });
  const keys = ['LOCALMCP_CONFIG', 'LOCALMCP_ROOT', 'LOCALMCP_SHELL', 'LOCALMCP_PORT'] as const;
  const saved = keys.map(key => [key, process.env[key]] as const);
  t.after(() => { for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  for (const key of keys) delete process.env[key]; process.env.LOCALMCP_CONFIG = f.profile;
  const load = (value: unknown) => config({ path: f.profile, content: JSON.stringify(value) });
  const initial = await config(); assert.equal(initial.fileRead, true); assert.equal(initial.fileWrite, false);
  assert.equal((await load({ root: f.root, permissions: { fileWrite: true } })).fileWrite, true);
  const disabled = await load({ root: f.root, features: { files: false }, permissions: { fileWrite: true } });
  assert.equal(disabled.fileRead, false); assert.equal(disabled.fileWrite, false);
  await assert.rejects(load({ root: f.root, permissions: { fileRead: false, fileWrite: true } }), /FILE_WRITE_REQUIRES_READ/);
  for (const permissions of [null, [], { fileWrite: 'true' }, { fileWrites: true }]) assert.equal(localMcpConfigSchema.safeParse({ root: f.root, permissions }).success, false);
});
test('actual stdio hot reload revokes cached writes and restores only after explicit permission', { timeout: 20000 }, async t => {
  const f = await fixture(t);
  const settings = { root: f.root, permissions: { fileRead: true, fileWrite: true }, features: { shell: false, processes: false } };
  await writeFile(f.profile, JSON.stringify(settings), { mode: 0o600 });
  const client = new Client({ name: 'permission-reload', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/index.js'), 'stdio'], env: { PATH: process.env.PATH ?? '', HOME: f.home, USERPROFILE: f.home, LOCALMCP_CONFIG: f.profile, LOCALMCP_SHELL: '0' }, stderr: 'pipe' });
  t.after(() => client.close()); await client.connect(transport);
  const cached = (await client.listTools()).tools; assert.ok(cached.some(tool => tool.name === 'write_file'));
  async function waitForWrite(allowed: boolean) {
    for (let i = 0; i < 80; i++) {
      if ((await client.listTools()).tools.some(tool => tool.name === 'write_file') === allowed) return;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.fail('permission reload did not settle');
  }
  const stage = f.profile + '.next'; settings.permissions.fileWrite = false;
  await writeFile(stage, JSON.stringify(settings), { mode: 0o600 }); await rename(stage, f.profile);
  await waitForWrite(false);
  for (const [name, args] of WRITE_CALLS) assert.equal((await client.callTool({ name, arguments: args })).isError, true);
  assert.equal(await readFile(join(f.root, 'note.txt'), 'utf8'), 'before');
  settings.permissions.fileWrite = true;
  await writeFile(stage, JSON.stringify(settings), { mode: 0o600 }); await rename(stage, f.profile);
  await waitForWrite(true);
  assert.notEqual((await client.callTool({ name: 'write_file', arguments: { path: 'note.txt', content: 'after', overwrite: true } })).isError, true);
  assert.equal(await readFile(join(f.root, 'note.txt'), 'utf8'), 'after');
});
