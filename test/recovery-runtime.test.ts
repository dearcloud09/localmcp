import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { nodeEntrypoint } from './helpers/node-entrypoint.js';
import { RuntimeMutations, initializeRecovery, bindMutationSnapshot, selectFileWorkspace } from '../src/core/mutation-runtime.js';
import { parseRecoveryConfig, resolveRecoveryConfig, type RecoveryHostConfig } from '../src/core/recovery-config.js';
import { ToolRegistry } from '../src/core/registry.js';
import { DurableMutationJournal } from '../src/core/durable-mutation-journal.js';

async function fixture(t: { after: (fn: () => unknown) => void }) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-runtime-journal-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = join(base, 'project'); await mkdir(project, { mode: 0o700 });
  const configFile = join(base, 'profile.json'); await writeFile(configFile, '{}', { mode: 0o600 });
  const recovery = await resolveRecoveryConfig({ mode: 'durable', directory: join(base, 'journal') }, { project }, configFile);
  const config: RecoveryHostConfig = { recovery, workspaces: { project }, defaultWorkspace: 'project', configFile };
  await writeFile(join(project, 'a.ts'), 'let value = 1;\n');
  return { base, project, config, directory: join(base, 'journal') };
}
const absent = async (path: string) => { await assert.rejects(lstat(path), { code: 'ENOENT' }); };
const id = () => randomUUID();
const edit = async (runtime: RuntimeMutations, config: RecoveryHostConfig, operationId: string) => {
  const ws = runtime.workspace(config).ws; const before = await ws.readVersion('a.ts');
  return { opts: { expectedSha256: before.sha256, operationId }, ws };
};

test('recovery defaults to memory and rejects coercion/unknown settings', () => {
  assert.deepEqual(parseRecoveryConfig(undefined), { mode: 'memory' });
  for (const value of [null, true, [], '', {}, { mode: 'bad' }, { mode: 'memory', directory: '/tmp/x' }, { mode: 'durable', directory: 'x' }, { mode: 'durable', directory: '/tmp/x', reset: true }]) {
    assert.throws(() => parseRecoveryConfig(value), /RECOVERY_/);
  }
});
test('durable recovery limit validation rejects null/string/zero/overflow without coercion', () => {
  for (const value of [null, '2', 0, -1, 1.5, 10001, Infinity]) assert.throws(() => parseRecoveryConfig({ mode: 'durable', directory: '/tmp/a', capacity: value }), /RECOVERY_INVALID_LIMIT/);
  for (const value of [null, '2', 0, 30001]) assert.throws(() => parseRecoveryConfig({ mode: 'durable', directory: '/tmp/a', lockWaitMs: value }), /RECOVERY_INVALID_LIMIT/);
  assert.equal(parseRecoveryConfig({ mode: 'durable', directory: '/tmp/a', capacity: 1, lockWaitMs: 1 }).mode, 'durable');
});
test('normalization performs no provisioning', async t => {
  const f = await fixture(t); await absent(f.directory);
  assert.deepEqual((await readdir(f.base)).sort(), ['profile.json', 'project']);
});
test('normalization checks every workspace, not only the default', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveRecoveryConfig(f.config.recovery, { project: f.project, unsafe: f.base }, f.config.configFile), /RECOVERY_WORKSPACE_OVERLAP/);
  await absent(f.directory);
});
test('normalization resolves parent symlink before checking overlap', async t => {
  const f = await fixture(t); await symlink(f.project, join(f.base, 'alias'));
  await assert.rejects(resolveRecoveryConfig({ mode: 'durable', directory: join(f.base, 'alias', 'journal') }, f.config.workspaces, f.config.configFile), /RECOVERY_WORKSPACE_OVERLAP/);
  await absent(join(f.project, 'journal'));
});
test('unsafe journal parent permissions fail without widening them', async t => {
  const f = await fixture(t); const parent = join(f.base, 'shared'); await mkdir(parent, { mode: 0o755 });
  await assert.rejects(resolveRecoveryConfig({ mode: 'durable', directory: join(parent, 'journal') }, f.config.workspaces, f.config.configFile), /RECOVERY_PARENT_NOT_PRIVATE/);
  assert.equal((await lstat(parent)).mode & 0o777, 0o755); await absent(join(parent, 'journal'));
});
test('symlink journal leaf is rejected before following it', async t => {
  const f = await fixture(t); const target = join(f.base, 'other'); await mkdir(target, { mode: 0o700 }); await symlink(target, f.directory);
  await assert.rejects(resolveRecoveryConfig(f.config.recovery, f.config.workspaces, f.config.configFile), /RECOVERY_UNSAFE_DIRECTORY/);
  assert.deepEqual(await readdir(target), []);
});
test('configuration itself cannot be stored in the journal namespace', async t => {
  const f = await fixture(t); await mkdir(f.directory, { mode: 0o700 }); const path = join(f.directory, 'profile.json'); await writeFile(path, '{}');
  await assert.rejects(resolveRecoveryConfig(f.config.recovery, f.config.workspaces, path), /RECOVERY_CONFIG_OVERLAP/);
});
test('durable recovery requires a real operator config path', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveRecoveryConfig(f.config.recovery, f.config.workspaces), /RECOVERY_CONFIG_FILE_REQUIRED/);
  await absent(f.directory);
});
test('runtime startup rejects a missing journal instead of recreating or falling back', async t => {
  const f = await fixture(t); await assert.rejects(RuntimeMutations.open(f.config), /JOURNAL_NOT_INITIALIZED/); await absent(f.directory);
});
test('provisioning is create-only and does not overwrite existing metadata', async t => {
  const f = await fixture(t); await initializeRecovery(f.config);
  const before = await readFile(join(f.directory, 'metadata.json'));
  await assert.rejects(initializeRecovery(f.config), /JOURNAL_ALREADY_EXISTS/);
  assert.deepEqual(await readFile(join(f.directory, 'metadata.json')), before);
});
test('existing empty namespaces are not initialized by startup or provisioning', async t => {
  const f = await fixture(t); await mkdir(f.directory, { mode: 0o700 });
  await assert.rejects(RuntimeMutations.open(f.config), { code: 'ENOENT' });
  await assert.rejects(initializeRecovery(f.config), /JOURNAL_ALREADY_EXISTS/);
  assert.deepEqual(await readdir(f.directory), []);
});
test('memory mode preserves legacy workspace behavior and creates no journal', async t => {
  const f = await fixture(t); const config = { ...f.config, recovery: undefined };
  const runtime = await RuntimeMutations.open(config);
  assert.equal(runtime.describe().restartPersistent, false);
  await runtime.workspace(config).ws.editText('a.ts', 'value = 1', 'value = 2');
  assert.equal(await readFile(join(f.project, 'a.ts'), 'utf8'), 'let value = 2;\n'); await absent(f.directory);
  await assert.rejects(initializeRecovery(config), /RECOVERY_DURABLE_REQUIRED/);
});
test('durable config without an attached runtime is rejected by the actual selector', async t => {
  const f = await fixture(t); assert.throws(() => selectFileWorkspace({ config: f.config }), /RECOVERY_RUNTIME_REQUIRED/);
  assert.equal(selectFileWorkspace({ config: { ...f.config, recovery: undefined } }).name, 'project');
});
test('new per-call Workspaces share one runtime journal for twenty identical edits', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  const operation = await edit(runtime, f.config, id());
  const result = await Promise.all(Array.from({ length: 20 }, () => selectFileWorkspace(bindMutationSnapshot({ config: f.config }, runtime)).ws.editText('a.ts', 'value = 1', 'value = 2', operation.opts)));
  assert.equal(result.filter(r => r.replayed === false).length, 1);
  assert.equal(result.filter(r => r.replayed === true).length, 19);
  assert.equal(await readFile(join(f.project, 'a.ts'), 'utf8'), 'let value = 2;\n');
});
test('runtime re-open replays a successful receipt without modifying current source', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const first = await RuntimeMutations.open(f.config);
  const { opts, ws } = await edit(first, f.config, id()); const result = await ws.editText('a.ts', 'value = 1', 'value = 2', opts);
  await writeFile(join(f.project, 'a.ts'), 'let value = 3;\n');
  const second = await RuntimeMutations.open(f.config); const replay = await second.workspace(f.config).ws.editText('a.ts', 'value = 1', 'value = 2', opts);
  assert.equal(replay.replayed, true); assert.equal(replay.afterSha256, result.afterSha256);
  assert.equal(await readFile(join(f.project, 'a.ts'), 'utf8'), 'let value = 3;\n');
});
test('real separate runtime processes re-open the same journal', async t => {
  const f = await fixture(t); await initializeRecovery(f.config);
  const runtime = await RuntimeMutations.open(f.config); const operation = await edit(runtime, f.config, id());
  const settings = join(f.base, 'child.json'); await writeFile(settings, JSON.stringify({ config: f.config, opts: operation.opts }));
  const child = nodeEntrypoint('./fixtures/runtime-journal-child.js', import.meta.url);
  const run = () => spawnSync(process.execPath, [...child.execArgv, child.path, settings], { encoding: 'utf8', timeout: 10000 });
  const first = run(); assert.equal(first.status, 0, first.stderr); assert.equal(JSON.parse(first.stdout).replayed, false);
  await writeFile(join(f.project, 'a.ts'), 'let value = 3;\n');
  const second = run(); assert.equal(second.status, 0, second.stderr); assert.equal(JSON.parse(second.stdout).replayed, true);
  assert.equal(await readFile(join(f.project, 'a.ts'), 'utf8'), 'let value = 3;\n');
});
test('live permission revocation rejects replay before parser and executor', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  const { opts } = await edit(runtime, f.config, id());
  const config = { ...f.config, files: true, fileRead: true, fileWrite: true, shell: false, processes: false };
  type Context = { config: typeof config; mutations: RuntimeMutations };
  const registry = new ToolRegistry<Context>(); let parses = 0, executions = 0;
  registry.register({ name: 'guarded_edit', module: 'files', backend: 'internal', description: 'Actual registry and Workspace composition; not an SDK or Zod substitute.',
    inputSchema: { type: 'object' }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, requires: ['files', 'fileRead', 'fileWrite'],
    parse: () => { parses++; return opts; }, execute: (o, c) => { executions++; return selectFileWorkspace(c).ws.editText('a.ts', 'value = 1', 'value = 2', o); } });
  const context = () => bindMutationSnapshot({ config }, runtime);
  await registry.call('guarded_edit', {}, context()); config.fileWrite = false;
  assert.equal(registry.list(context()).length, 0);
  await assert.rejects(registry.call('guarded_edit', {}, context()), /Unknown tool/);
  assert.equal(parses, 1); assert.equal(executions, 1);
  config.fileWrite = true;
  const replay = await registry.call('guarded_edit', {}, context()); assert.equal((replay.result as { replayed: boolean }).replayed, true);
});
test('durable namespace mode/path/capacity/scopes cannot switch via a live snapshot', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  const recovery = f.config.recovery!; assert.equal(recovery.mode, 'durable');
  for (const changed of [{ ...f.config, recovery: undefined },
    { ...f.config, recovery: parseRecoveryConfig({ ...recovery, directory: join(f.base, 'other') }) },
    { ...f.config, recovery: parseRecoveryConfig({ ...recovery, capacity: 12 }) },
    { ...f.config, workspaces: { second: f.base } }]) {
    assert.throws(() => bindMutationSnapshot({ config: changed }, runtime), /RECOVERY_RESTART_REQUIRED/);
  }
  await absent(join(f.base, 'other'));
});
test('memory-to-durable hot switch is rejected while memory-only workspace reload remains compatible', async t => {
  const f = await fixture(t); const config = { ...f.config, recovery: undefined }; const runtime = await RuntimeMutations.open(config);
  assert.throws(() => runtime.assertCompatible(f.config), /RECOVERY_RESTART_REQUIRED/);
  assert.doesNotThrow(() => runtime.assertCompatible({ ...config, workspaces: { another: f.project }, defaultWorkspace: 'another' }));
  await absent(f.directory);
});
test('workspace rename/ordering does not create a new durable namespace', async t => {
  const f = await fixture(t); const config = { ...f.config, workspaces: { project: f.project, alias: f.project } };
  await initializeRecovery(config); const runtime = await RuntimeMutations.open(config);
  const next = { ...config, workspaces: { alias: f.project, renamed: f.project }, defaultWorkspace: 'renamed' };
  assert.equal(selectFileWorkspace(bindMutationSnapshot({ config: next }, runtime)).name, 'renamed');
});
test('an unrelated runtime object cannot be smuggled into an existing snapshot binding', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const a = await RuntimeMutations.open(f.config), b = await RuntimeMutations.open(f.config);
  assert.throws(() => bindMutationSnapshot({ config: f.config, mutations: b }, a), /RECOVERY_RUNTIME_REPLACED/);
});
test('deleted durable namespace is never auto-created on re-open or operation', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config); const { ws, opts } = await edit(runtime, f.config, id());
  await rm(f.directory, { recursive: true });
  await assert.rejects(ws.editText('a.ts', 'value = 1', 'value = 2', opts), { code: 'ENOENT' });
  await assert.rejects(RuntimeMutations.open(f.config), /JOURNAL_NOT_INITIALIZED/);
  await absent(f.directory); assert.equal(await readFile(join(f.project, 'a.ts'), 'utf8'), 'let value = 1;\n');
});
test('corrupt metadata blocks runtime restart without resetting history', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); await writeFile(join(f.directory, 'metadata.json'), '{bad');
  await assert.rejects(RuntimeMutations.open(f.config), /JOURNAL_INVALID_RECORD/);
  assert.equal(await readFile(join(f.directory, 'metadata.json'), 'utf8'), '{bad');
});
test('incomplete persisted edit refuses replay through re-opened runtime', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  const { ws, opts } = await edit(runtime, f.config, id()); await ws.editText('a.ts', 'value = 1', 'value = 2', opts);
  const op = (await readdir(f.directory)).find(n => n.startsWith('op-'))!;
  await rm(join(f.directory, op, 'terminal.json')); const reopened = await RuntimeMutations.open(f.config);
  await assert.rejects(reopened.workspace(f.config).ws.editText('a.ts', 'value = 1', 'value = 2', opts), /OPERATION_OUTCOME_UNKNOWN/);
  assert.equal(await readFile(join(f.project, 'a.ts'), 'utf8'), 'let value = 2;\n');
});
test('persisted failure and different-payload replay remain denied after restart', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  const { ws, opts } = await edit(runtime, f.config, id()); await assert.rejects(ws.editText('a.ts', 'not present', 'new', opts), /oldText/);
  const reopened = await RuntimeMutations.open(f.config);
  await assert.rejects(reopened.workspace(f.config).ws.editText('a.ts', 'not present', 'new', opts), /OPERATION_PREVIOUSLY_FAILED/);
  await assert.rejects(reopened.workspace(f.config).ws.editText('a.ts', 'value = 1', 'value = 2', opts), /OPERATION_ID_CONFLICT/);
});
test('public recovery diagnostics contain no journal path or ledger records', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  const description = runtime.describe(); assert.equal(description.mode, 'durable'); assert.equal(description.atomicFileAndJournal, false);
  assert.ok(!JSON.stringify(description).includes(f.base)); assert.ok(!Object.hasOwn(description, 'directory'));
});
test('selectors reject inherited and unknown workspace names', async t => {
  const f = await fixture(t); await initializeRecovery(f.config); const runtime = await RuntimeMutations.open(f.config);
  assert.throws(() => runtime.workspace(f.config, 'toString'), /Unknown workspace/);
  assert.throws(() => selectFileWorkspace({ config: { ...f.config, recovery: undefined } }, '__proto__'), /Unknown workspace/);
});
test('explicit journal open modes are checked without accepting arbitrary strings', async t => {
  const f = await fixture(t);
  await assert.rejects(DurableMutationJournal.open({ directory: f.directory, workspaceRoots: [f.project], openMode: 'reset' as never }), /JOURNAL_INVALID_CONFIG/);
  await absent(f.directory);
});
test('workspace nested inside a candidate journal is rejected', async t => {
  const f = await fixture(t);
  const parent = join(f.base, 'namespace'); const child = join(parent, 'nested-project');
  await mkdir(parent, { mode: 0o700 }); await mkdir(child);
  await assert.rejects(resolveRecoveryConfig({ mode: 'durable', directory: parent }, { nested: child }, f.config.configFile), /RECOVERY_WORKSPACE_OVERLAP/);
});
