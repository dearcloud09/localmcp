import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeEntrypoint } from './helpers/node-entrypoint.js';
import { fork, spawnSync } from 'node:child_process';
import { DurableMutationJournal, type EditReceipt } from '../src/core/durable-mutation-journal.js';
import { inspectRecovery } from '../src/core/recovery-inspection.js';
import { mutationPath } from '../src/core/mutation-coordinator.js';
import { parseInspectionArguments } from '../src/recovery-inspect.js';
import { Workspace } from '../src/workspace.js';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const fingerprint = hash('inspection test');
const operation = 'operation-inspection-01';
const receipt = (): EditReceipt => ({ path: 'private-looking-filename.ts', bytes: 3, beforeSha256: hash('old'), afterSha256: hash('new') });
const cli = nodeEntrypoint('../src/recovery-inspect.js', import.meta.url);
async function fixture(t: TestContext, capacity = 1024) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp inspection ')));
  const project = join(base, 'project'), directory = join(base, 'journal'); await mkdir(project, { mode: 0o700 });
  const options = { directory, workspaceRoots: [project], capacity };
  const journal = await DurableMutationJournal.open(options);
  t.after(() => rm(base, { recursive: true, force: true }));
  return { base, project, directory, options, journal, scope: mutationPath(project) };
}
async function opDir(directory: string) { return join(directory, (await readdir(directory)).find(n => n.startsWith('op-'))!); }
async function snapshot(path: string): Promise<unknown> {
  const s = await lstat(path);
  const common = { mode: s.mode, ino: s.ino, mtime: s.mtimeMs, ctime: s.ctimeMs, size: s.size };
  if (s.isSymbolicLink()) return common;
  if (s.isDirectory()) return { ...common, children: await Promise.all((await readdir(path)).sort().map(async n => [n, await snapshot(join(path, n))])) };
  return { ...common, bytes: hash((await readFile(path)).toString('hex')) };
}
const runCli = (f: Awaited<ReturnType<typeof fixture>>, more: string[] = []) => spawnSync(process.execPath,
  [...cli.execArgv, cli.path, '--directory', f.directory, '--workspace', f.project, '--capacity', String(f.options.capacity), ...more],
  { encoding: 'utf8', timeout: 15000, env: { PATH: process.env.PATH, HOME: f.base, LANG: 'C.UTF-8' } });

test('empty inventory reads an existing namespace without modifying bytes, modes or mtimes', async t => {
  const f = await fixture(t); const before = await snapshot(f.base);
  const result = await inspectRecovery(f.options);
  assert.equal(result.status, 'inspection_completed'); assert.deepEqual(result.inventory.records, []);
  assert.equal(result.inventory.atomicSnapshot, false); assert.equal(result.inventory.automaticRetry, false);
  assert.equal(result.wholeJournalHealthAsserted, false); assert.equal(result.assessmentScope, 'returned_page_and_optional_operation');
  assert.equal(result.inventory.ownerLiveness, 'not_inferred'); assert.deepEqual(await snapshot(f.base), before);
});
test('missing inventory is blocked without provisioning a replacement', async t => {
  const f = await fixture(t); await rm(f.directory, { recursive: true });
  await assert.rejects(inspectRecovery(f.options), /JOURNAL_NOT_INITIALIZED/);
  await assert.rejects(lstat(f.directory), { code: 'ENOENT' });
});
test('empty uninitialized inventory is not silently initialized', async t => {
  const f = await fixture(t); await rm(f.directory, { recursive: true }); await mkdir(f.directory, { mode: 0o700 });
  await assert.rejects(inspectRecovery(f.options)); assert.deepEqual(await readdir(f.directory), []);
});
test('inventory success is a historical receipt, not permission to run or proof of current contents', async t => {
  const f = await fixture(t); let effects = 0;
  await f.journal.run(f.scope, operation, fingerprint, async () => { effects++; return receipt(); });
  const before = await snapshot(f.base), result = await inspectRecovery(f.options), record = result.inventory.records[0];
  assert.equal(record.state, 'succeeded'); assert.equal(record.nextAction, 'historical_receipt_only');
  assert.equal(record.automaticRetry, false); assert.equal(effects, 1); assert.deepEqual(await snapshot(f.base), before);
});
test('default output redacts IDs, scopes, file paths, fingerprints and receipt hashes', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, operation, fingerprint, async () => receipt());
  const text = JSON.stringify(await inspectRecovery(f.options));
  for (const secret of [operation, f.base, f.project, f.directory, receipt().path, receipt().beforeSha256, receipt().afterSha256, fingerprint]) assert.ok(!text.includes(secret), secret);
  assert.match(text, /op-[a-f0-9]{64}/);
});
test('failed callback with a real effect stays failed and is never replayed by inspection', async t => {
  const f = await fixture(t);
  await assert.rejects(f.journal.run(f.scope, operation, fingerprint, async () => { await writeFile(join(f.project, 'effect'), 'yes'); throw new Error('do not print this'); }));
  const before = await snapshot(f.base), result = await inspectRecovery(f.options);
  assert.equal(result.status, 'operator_review_required'); assert.equal(result.inventory.records[0].state, 'failed');
  assert.deepEqual(await snapshot(f.base), before);
});
test('active callback is unresolved and inspection neither waits for nor cancels it', async t => {
  const f = await fixture(t); let reached!: () => void, release!: () => void;
  const entered = new Promise<void>(r => { reached = r; }), hold = new Promise<void>(r => { release = r; });
  const running = f.journal.run(f.scope, operation, fingerprint, async () => { reached(); await hold; return receipt(); });
  await entered;
  try { const result = await inspectRecovery(f.options); assert.equal(result.inventory.records[0].state, 'unresolved'); assert.equal(result.inventory.records[0].reason, 'unfinished_or_active'); }
  finally { release(); await running; }
  assert.equal((await inspectRecovery(f.options)).inventory.records[0].state, 'succeeded');
});
test('corrupt terminal is unresolved and inspection preserves corrupt bytes', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, operation, fingerprint, async () => receipt());
  await writeFile(join(await opDir(f.directory), 'terminal.json'), '{bad\n'); const before = await snapshot(f.base);
  const result = await inspectRecovery(f.options); assert.equal(result.inventory.records[0].reason, 'invalid_record');
  assert.deepEqual(await snapshot(f.base), before);
});
test('empty operation directory is unresolved, not treated as absent or safe to retry', async t => {
  const f = await fixture(t); await mkdir(join(f.directory, 'op-' + 'a'.repeat(64)), { mode: 0o700 });
  const record = (await inspectRecovery(f.options)).inventory.records[0];
  assert.equal(record.state, 'unresolved'); assert.equal(record.automaticRetry, false);
});
test('lingering allocation lock is reported without deleting or stealing it', async t => {
  const f = await fixture(t); await mkdir(join(f.directory, '.allocation-lock'), { mode: 0o700 }); const before = await snapshot(f.base);
  const result = await inspectRecovery(f.options);
  assert.equal(result.inventory.allocationLock, 'observed_present'); assert.equal(result.status, 'operator_review_required');
  assert.equal(result.locksRemoved, false); assert.deepEqual(await snapshot(f.base), before);
});
test('bounded pagination has stable references and never presents one page as all records', async t => {
  const f = await fixture(t); for (let i = 0; i < 5; i++) await f.journal.run(f.scope, `operation-${i}`, fingerprint, async () => receipt());
  const references: string[] = []; let after: string | undefined;
  for (let i = 0; i < 3; i++) {
    const result = await inspectRecovery({ ...f.options, limit: 2, after });
    assert.equal(result.inventory.totalObserved, 5); assert.equal(result.inventory.atomicSnapshot, false);
    references.push(...result.inventory.records.map(r => r.reference));
    if (i < 2) assert.equal(result.status, 'operator_review_required');
    after = result.inventory.nextCursor ?? undefined;
  }
  assert.equal(after, undefined); assert.equal(new Set(references).size, 5); assert.deepEqual([...references].sort(), references);
});
test('invalid cursor and limit are rejected before listing', async t => {
  const f = await fixture(t);
  for (const limit of [0, -1, 1.1, 201, NaN]) await assert.rejects(f.journal.inventory({ limit }), /JOURNAL_INVALID_INSPECTION/);
  for (const after of ['', '../secret', 'op-' + 'Z'.repeat(64)]) await assert.rejects(f.journal.inventory({ after }), /JOURNAL_INVALID_INSPECTION/);
});
test('capacity exhaustion is visible even if every existing operation succeeded', async t => {
  const f = await fixture(t, 1); await f.journal.run(f.scope, operation, fingerprint, async () => receipt());
  const result = await inspectRecovery(f.options); assert.equal(result.inventory.capacityRemainingObserved, 0);
  assert.equal(result.status, 'operator_review_required');
});
test('unexpected root entries fail closed without exposing names or deleting entries', async t => {
  const f = await fixture(t); await writeFile(join(f.directory, 'SECRET_NAME'), 'SECRET_CONTENT'); const before = await snapshot(f.base);
  const r = runCli(f); assert.equal(r.status, 1); assert.match(r.stderr, /JOURNAL_UNEXPECTED_ENTRY/);
  assert.ok(!r.stderr.includes('SECRET')); assert.deepEqual(await snapshot(f.base), before);
});
test('inventory node count cannot grow beyond the configured capacity', async t => {
  const f = await fixture(t, 1);
  for (const c of ['a', 'b']) await mkdir(join(f.directory, 'op-' + c.repeat(64)), { mode: 0o700 });
  await assert.rejects(inspectRecovery(f.options), /JOURNAL_INSPECTION_LIMIT/);
});
test('linked operation folder is reported blocked without reading the linked target', async t => {
  const f = await fixture(t); const outside = join(f.base, 'outside'); await mkdir(outside, { mode: 0o700 });
  await writeFile(join(outside, 'begin.json'), 'SECRET'); await symlink(outside, join(f.directory, 'op-' + 'a'.repeat(64)));
  const result = await inspectRecovery(f.options); assert.equal(result.inventory.records[0].state, 'blocked');
  assert.equal(result.inventory.records[0].reason, 'unsafe_record'); assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('hard-linked record file is blocked without relaxing permissions', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, operation, fingerprint, async () => receipt());
  await link(join(await opDir(f.directory), 'terminal.json'), join(f.base, 'alias'));
  const result = await inspectRecovery(f.options); assert.equal(result.inventory.records[0].state, 'blocked');
});
test('world-readable record is blocked, not chmodded by inspection', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, operation, fingerprint, async () => receipt());
  const file = join(await opDir(f.directory), 'begin.json'); await chmod(file, 0o644);
  assert.equal((await inspectRecovery(f.options)).inventory.records[0].state, 'blocked'); assert.equal((await lstat(file)).mode & 0o777, 0o644);
});
test('corrupt metadata and metadata changes after open are both rejected', async t => {
  const f = await fixture(t); await writeFile(join(f.directory, 'metadata.json'), '{}');
  await assert.rejects(f.journal.inventory(), /JOURNAL_INVALID_RECORD/); await assert.rejects(inspectRecovery(f.options));
});
test('replaced namespace is rejected by an existing inspector', async t => {
  const f = await fixture(t); await rename(f.directory, f.directory + '-old'); await mkdir(f.directory, { mode: 0o700 });
  await assert.rejects(f.journal.inventory(), /JOURNAL_REPLACED/);
});
test('known absent ID is not a statement that no effect ever happened', async t => {
  const f = await fixture(t); const result = await inspectRecovery({ ...f.options, operationId: operation, scope: f.project });
  assert.equal(result.operation!.state, 'absent'); assert.equal(result.operation!.nextAction, 'no_record_not_proof_of_no_effect');
  assert.equal(result.operation!.automaticRetry, false); assert.equal(result.status, 'operator_review_required');
});
test('optional current-file comparison can match a successful receipt without exposing content', async t => {
  const f = await fixture(t); await writeFile(join(f.project, 'a.ts'), 'old'); const ws = new Workspace(f.project, f.journal);
  await ws.editText('a.ts', 'old', 'new', { operationId: operation, expectedSha256: hash('old') });
  const before = await snapshot(f.base), result = await inspectRecovery({ ...f.options, operationId: operation, scope: f.project, compareCurrent: true });
  assert.equal(result.operation!.currentFile, 'matches_recorded_after'); assert.equal(result.operation!.currentFileProvesActorOrExactlyOnce, false);
  assert.ok(!JSON.stringify(result).includes('a.ts')); assert.deepEqual(await snapshot(f.base), before);
});
test('external change does not rewrite a historical success or get overwritten by inspection', async t => {
  const f = await fixture(t); await writeFile(join(f.project, 'a.ts'), 'old');
  await new Workspace(f.project, f.journal).editText('a.ts', 'old', 'new', { operationId: operation, expectedSha256: hash('old') });
  await writeFile(join(f.project, 'a.ts'), 'external'); const before = await snapshot(f.base);
  const result = await inspectRecovery({ ...f.options, operationId: operation, scope: f.project, compareCurrent: true });
  assert.equal(result.operation!.state, 'succeeded'); assert.equal(result.operation!.currentFile, 'differs_from_recorded_after');
  assert.equal(result.status, 'operator_review_required'); assert.deepEqual(await snapshot(f.base), before);
});
test('deleted or protected current file is unavailable, not recreated or read through the guard', async t => {
  const f = await fixture(t);
  await f.journal.run(f.scope, operation, fingerprint, async () => ({ ...receipt(), path: '.env' }));
  await writeFile(join(f.project, '.env'), 'DO_NOT_EXPOSE'); const before = await snapshot(f.base);
  const result = await inspectRecovery({ ...f.options, operationId: operation, scope: f.project, compareCurrent: true });
  assert.equal(result.operation!.currentFile, 'unavailable'); assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
  assert.deepEqual(await snapshot(f.base), before);
});
test('known ID scope must belong to the journal workspace set', async t => {
  const f = await fixture(t); const other = join(f.base, 'other'); await mkdir(other);
  await assert.rejects(inspectRecovery({ ...f.options, operationId: operation, scope: other }), /JOURNAL_INVALID_OPERATION/);
});
test('query arguments are strict and never offer reset, retry, unlock or force', () => {
  const base = ['--directory', '/tmp/journal', '--workspace', '/tmp/project'];
  assert.equal(parseInspectionArguments(base).directory, '/tmp/journal');
  for (const extra of [['--reset'], ['--retry'], ['--force'], ['--unlock'], ['--directory', '/tmp/other'], ['--compare-current'], ['--scope', '/tmp/project'], ['--limit', '0'], ['--capacity', '10001'], ['--after', '../x']]) assert.throws(() => parseInspectionArguments([...base, ...extra]), /INSPECTION_/);
});
test('paths with spaces and several workspace flags remain literal arguments', () => {
  const result = parseInspectionArguments(['--directory', '/tmp/with space', '--workspace', '/tmp/project one', '--workspace', '/tmp/project two']);
  assert.deepEqual(result.workspaceRoots, ['/tmp/project one', '/tmp/project two']);
});
test('real CLI returns JSON and exit 0 for an observationally clean inventory', async t => {
  const f = await fixture(t); const before = await snapshot(f.base), r = runCli(f);
  assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).status, 'inspection_completed');
  assert.equal(r.stderr, ''); assert.deepEqual(await snapshot(f.base), before);
});
test('real CLI returns exit 2 for unresolved or locked inventory, without claiming recovery', async t => {
  const f = await fixture(t); await mkdir(join(f.directory, '.allocation-lock'), { mode: 0o700 });
  const r = runCli(f); assert.equal(r.status, 2, r.stderr); const value = JSON.parse(r.stdout);
  assert.equal(value.status, 'operator_review_required'); assert.equal(value.actionsExecuted, false); assert.equal(value.locksRemoved, false);
});
test('real CLI errors are sanitized and cannot expose a supplied path', async t => {
  const f = await fixture(t); await rm(f.directory, { recursive: true }); const r = runCli(f);
  assert.equal(r.status, 1); assert.ok(!r.stderr.includes(f.base)); assert.equal(r.stdout, '');
  assert.equal(JSON.parse(r.stderr).recordsChanged, false);
});
test('real killed worker is inspected by a separate CLI without repeating its effect', { timeout: 20000 }, async t => {
  const f = await fixture(t); await writeFile(join(f.project, 'effects.txt'), '');
  const childFile = nodeEntrypoint('./fixtures/durable-child.js', import.meta.url);
  const child = fork(childFile.path, [f.directory, f.project, operation, 'after'], { silent: true, execArgv: childFile.execArgv, env: { PATH: process.env.PATH, HOME: f.base } });
  const closed = new Promise<void>((r, j) => { child.once('error', j); child.once('close', () => r()); });
  let timer: ReturnType<typeof setTimeout>;
  t.after(async () => { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await closed; });
  await new Promise<void>((r, j) => { timer = setTimeout(() => j(new Error('fixture checkpoint not reached')), 10000); child.once('error', j); child.on('message', m => { if ((m as { phase?: string }).phase === 'after') { clearTimeout(timer); r(); } }); });
  child.kill('SIGKILL'); await closed;
  const before = await snapshot(f.base), r = runCli(f); assert.equal(r.status, 2, r.stderr);
  const record = JSON.parse(r.stdout).inventory.records[0]; assert.equal(record.state, 'unresolved'); assert.equal(record.reason, 'unfinished_or_active');
  assert.equal(await readFile(join(f.project, 'effects.txt'), 'utf8'), 'effect\n'); assert.deepEqual(await snapshot(f.base), before);
});

test('leftover temporary or unexpected per-operation files need review and are not deleted', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, operation, fingerprint, async () => receipt());
  const p = join(await opDir(f.directory), '.pending-abandoned'); await writeFile(p, 'DO_NOT_PRINT_OR_DELETE');
  const before = await snapshot(f.base), result = await inspectRecovery(f.options);
  assert.equal(result.inventory.records[0].reason, 'unexpected_record_entry');
  assert.equal(result.status, 'operator_review_required'); assert.ok(!JSON.stringify(result).includes('DO_NOT_PRINT_OR_DELETE'));
  assert.deepEqual(await snapshot(f.base), before);
});
test('exact case-preserving workspace path is used for optional current-file comparison', async t => {
  const f = await fixture(t), project = join(f.base, 'MixedCASE Project'); await mkdir(project, { mode: 0o700 });
  const options = { directory: join(f.base, 'anotherJournal'), workspaceRoots: [project] };
  const j = await DurableMutationJournal.open(options); await writeFile(join(project, 'a.ts'), 'old');
  await new Workspace(project, j).editText('a.ts', 'old', 'new', { operationId: operation, expectedSha256: hash('old') });
  const result = await inspectRecovery({ ...options, operationId: operation, scope: project, compareCurrent: true });
  assert.equal(result.operation!.currentFile, 'matches_recorded_after');
});
