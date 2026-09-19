import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFilePermissions, FilePermissionError, FILE_READ_REQUIREMENTS, FILE_WRITE_REQUIREMENTS } from '../src/core/file-permissions.js';
import { ToolRegistry, type FeatureContext, type Receipt } from '../src/core/registry.js';
import { Workspace } from '../src/workspace.js';

const context = (raw?: unknown, files = true): FeatureContext => ({ config: { files, ...resolveFilePermissions(raw, files), shell: false, processes: false } });
const descriptor = { description: 'permission test', inputSchema: { type: 'object' as const }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } };
const denied = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'TOOL_UNAVAILABLE';

test('omitted permissions are read-only', () => assert.deepEqual(resolveFilePermissions(undefined, true), { fileRead: true, fileWrite: false }));
test('an empty permission object does not grant writing', () => assert.deepEqual(resolveFilePermissions({}, true), { fileRead: true, fileWrite: false }));
test('explicit write permission also requires read permission', () => assert.deepEqual(resolveFilePermissions({ fileWrite: true }, true), { fileRead: true, fileWrite: true }));
test('disabling read alone disables both default capabilities', () => assert.deepEqual(resolveFilePermissions({ fileRead: false }, true), { fileRead: false, fileWrite: false }));
test('write-only policy is rejected, not silently broadened', () => assert.throws(() => resolveFilePermissions({ fileRead: false, fileWrite: true }, true), e => e instanceof FilePermissionError && e.code === 'FILE_WRITE_REQUIRES_READ'));
test('files master switch overrides explicit grants', () => assert.deepEqual(resolveFilePermissions({ fileRead: true, fileWrite: true }, false), { fileRead: false, fileWrite: false }));
test('nonobject permission documents are rejected', () => {
  for (const raw of [null, [], true, 1, 'write']) assert.throws(() => resolveFilePermissions(raw, true), /FILE_PERMISSIONS_INVALID/);
});
test('strings numbers and null are not permission booleans', () => {
  for (const key of ['fileRead', 'fileWrite']) for (const value of ['true', 1, 0, null]) assert.throws(() => resolveFilePermissions({ [key]: value }, true), /FILE_PERMISSIONS_INVALID/);
});
test('typos are rejected rather than ignored', () => assert.throws(() => resolveFilePermissions({ fileWrites: true }, true), /Unknown file permission/));
test('invalid policy is rejected even when files are disabled', () => assert.throws(() => resolveFilePermissions({ fileWrite: 'yes' }, false), /FILE_PERMISSIONS_INVALID/));
test('permissions are not inherited from a prototype', () => assert.equal(resolveFilePermissions(Object.create({ fileWrite: true }), true).fileWrite, false));
test('feature master flag must be boolean at direct library boundary', () => assert.throws(() => resolveFilePermissions(undefined, 'true' as unknown as boolean), /FILE_PERMISSIONS_INVALID/));

test('denied write is hidden and rejected before parsing or execution', async () => {
  let parsed = 0, ran = 0; const receipts: Readonly<Receipt>[] = [];
  const registry = new ToolRegistry<FeatureContext>(r => receipts.push(r));
  registry.register({ ...descriptor, name: 'write_file', module: 'files', backend: 'internal', requires: FILE_WRITE_REQUIREMENTS, parse: raw => { parsed++; return raw; }, execute: () => { ran++; } });
  assert.equal(registry.list(context()).length, 0);
  await assert.rejects(registry.call('write_file', { fileWrite: true }, context()), denied);
  assert.equal(parsed, 0); assert.equal(ran, 0); assert.equal(receipts[0].outcome, 'denied');
});
test('read-only annotation never grants write authority', async () => {
  const registry = new ToolRegistry<FeatureContext>();
  registry.register({ ...descriptor, annotations: { ...descriptor.annotations, readOnlyHint: true }, name: 'mislabelled', module: 'files', backend: 'internal', requires: FILE_WRITE_REQUIREMENTS, parse: raw => raw, execute: () => assert.fail('must not execute') });
  await assert.rejects(registry.call('mislabelled', {}, context()), denied);
});
test('old embedding contexts fail closed when explicit file permissions are absent', async () => {
  const registry = new ToolRegistry<FeatureContext>();
  for (const [name, requires] of [['read_file', FILE_READ_REQUIREMENTS], ['write_file', FILE_WRITE_REQUIREMENTS]] as const) registry.register({ ...descriptor, name, module: 'files', backend: 'internal', requires, parse: raw => raw, execute: () => assert.fail('missing authority') });
  const old = { config: { files: true, shell: false, processes: false } };
  assert.equal(registry.list(old).length, 0); await assert.rejects(registry.call('read_file', {}, old), denied);
});
test('a cached catalog cannot authorize calls after policy replacement', async () => {
  const registry = new ToolRegistry<FeatureContext>(); let ran = 0;
  registry.register({ ...descriptor, name: 'write_file', module: 'files', backend: 'internal', requires: FILE_WRITE_REQUIREMENTS, parse: raw => raw, execute: () => ++ran });
  const c = context({ fileWrite: true }); const cached = registry.list(c); assert.equal(cached.length, 1);
  c.config = context().config;
  await assert.rejects(registry.call(cached[0].name, {}, c), denied); assert.equal(ran, 0);
  c.config = context({ fileWrite: true }).config;
  assert.equal((await registry.call('write_file', {}, c)).result, 1);
});
test('master feature switch still denies inconsistent embedded grants', async () => {
  const registry = new ToolRegistry<FeatureContext>();
  registry.register({ ...descriptor, name: 'write_file', module: 'files', backend: 'internal', requires: FILE_WRITE_REQUIREMENTS, parse: raw => raw, execute: () => assert.fail('files disabled') });
  const c = context({ fileWrite: true }); c.config.files = false;
  await assert.rejects(registry.call('write_file', {}, c), denied);
});
test('same explicit requirement gates internal CLI and MCP backends', async () => {
  const registry = new ToolRegistry<FeatureContext>();
  for (const backend of ['internal', 'cli', 'mcp'] as const) registry.register({ ...descriptor, name: `write_${backend}`, module: 'test', backend, requires: FILE_WRITE_REQUIREMENTS, parse: raw => raw, execute: () => backend });
  for (const backend of ['internal', 'cli', 'mcp']) await assert.rejects(registry.call(`write_${backend}`, {}, context()), denied);
  assert.equal(registry.list(context({ fileWrite: true })).length, 3);
});
test('separately enabled shell authority is not misrepresented as a file permission', () => {
  const registry = new ToolRegistry<FeatureContext>();
  registry.register({ ...descriptor, name: 'command', module: 'processes', backend: 'cli', requires: ['shell'], parse: raw => raw, execute: () => null });
  const c = context({ fileRead: false }); assert.equal(registry.list(c).length, 0);
  c.config.shell = true; assert.equal(registry.list(c).length, 1);
});
test('real file stays unchanged on denial and changes after explicit opt-in', async t => {
  const root = await mkdtemp(join(tmpdir(), 'file-permissions-')); t.after(() => rm(root, { recursive: true, force: true }));
  const ws = new Workspace(root); await writeFile(join(root, 'note.txt'), 'before');
  const registry = new ToolRegistry<FeatureContext>();
  registry.register({ ...descriptor, name: 'read_file', module: 'files', backend: 'internal', requires: FILE_READ_REQUIREMENTS, parse: () => null, execute: () => ws.read('note.txt') });
  registry.register({ ...descriptor, name: 'write_file', module: 'files', backend: 'internal', requires: FILE_WRITE_REQUIREMENTS, parse: () => null, execute: () => ws.write('note.txt', 'after', true) });
  assert.equal((await registry.call('read_file', {}, context())).result, 'before');
  await assert.rejects(registry.call('write_file', {}, context()), denied);
  assert.equal(await readFile(join(root, 'note.txt'), 'utf8'), 'before');
  await registry.call('write_file', {}, context({ fileWrite: true }));
  assert.equal(await readFile(join(root, 'note.txt'), 'utf8'), 'after');
});
