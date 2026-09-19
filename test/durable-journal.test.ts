import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DurableMutationJournal, type EditReceipt } from '../src/core/durable-mutation-journal.js';
import { MutationJournal, mutationPath } from '../src/core/mutation-coordinator.js';
import { Workspace } from '../src/workspace.js';

const fp = 'b'.repeat(64), id = 'operation-0001';
const receipt = (): EditReceipt => ({ path: 'a.txt', bytes: 2, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) });
const rejects = (p: Promise<unknown>, code: string) => assert.rejects(p, e => (e as { code?: string }).code === code);
async function fixture(t: TestContext, capacity = 1024) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp durable ')));
  const project = join(base, 'project'), directory = join(base, 'journal'); await mkdir(project, { mode: 0o700 });
  t.after(() => rm(base, { recursive: true, force: true }));
  const options = { directory, workspaceRoots: [project], capacity, lockWaitMs: 2000 };
  const journal = await DurableMutationJournal.open(options);
  return { base, project, directory, options, journal, scope: mutationPath(project) };
}
async function operationDirectory(directory: string) { return join(directory, (await readdir(directory)).find(n => n.startsWith('op-'))!); }
async function contents(directory: string): Promise<string> {
  let out = ''; for (const name of await readdir(directory)) { const p = join(directory, name), s = await lstat(p); out += s.isDirectory() ? await contents(p) : await readFile(p, 'utf8'); } return out;
}

test('persistent success is replayed by a fresh journal instance without rerunning action', async t => {
  const f = await fixture(t); let calls = 0;
  assert.deepEqual(await f.journal.inspect(f.scope, id), { state: 'absent' });
  assert.equal((await f.journal.run(f.scope, id, fp, async () => { calls++; return receipt(); })).replayed, false);
  const reopened = await DurableMutationJournal.open(f.options);
  assert.deepEqual(await reopened.run(f.scope, id, fp, async () => { calls++; return receipt(); }), { value: receipt(), replayed: true });
  assert.equal(calls, 1); assert.equal((await reopened.inspect(f.scope, id)).state, 'succeeded');
});
test('negative control: memory journal forgets an ID on replacement, durable journal does not', async t => {
  const f = await fixture(t); let memory = 0, durable = 0;
  for (let i = 0; i < 2; i++) {
    await new MutationJournal().run(f.scope, id, fp, async () => { memory++; return receipt(); });
    await (await DurableMutationJournal.open(f.options)).run(f.scope, id, fp, async () => { durable++; return receipt(); });
  }
  assert.equal(memory, 2); assert.equal(durable, 1);
});
test('20 same-instance concurrent calls share exactly one action and immutable receipts', async t => {
  const f = await fixture(t); let calls = 0;
  const results = await Promise.all(Array.from({ length: 20 }, () => f.journal.run(f.scope, id, fp, async () => { calls++; return receipt(); })));
  assert.equal(calls, 1); assert.equal(results.filter(r => !r.replayed).length, 1);
  results[0].value.path = 'changed'; assert.equal(results[1].value.path, 'a.txt');
});
test('same ID with a different request is rejected across reopen', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, id, fp, async () => receipt());
  await rejects((await DurableMutationJournal.open(f.options)).run(f.scope, id, 'c'.repeat(64), async () => assert.fail()), 'OPERATION_ID_CONFLICT');
});
test('terminal failure is remembered and original exception details are not persisted', async t => {
  const f = await fixture(t); let calls = 0;
  await assert.rejects(f.journal.run(f.scope, 'SECRET_TOKEN_ID_01', fp, async () => { calls++; throw new Error('SECRET_CONTENT_SENTINEL'); }), /SECRET_CONTENT_SENTINEL/);
  assert.equal((await f.journal.inspect(f.scope, 'SECRET_TOKEN_ID_01')).state, 'failed');
  await rejects((await DurableMutationJournal.open(f.options)).run(f.scope, 'SECRET_TOKEN_ID_01', fp, async () => { calls++; return receipt(); }), 'OPERATION_PREVIOUSLY_FAILED');
  assert.equal(calls, 1); const disk = await contents(f.directory);
  assert.ok(!disk.includes('SECRET_')); assert.ok(!disk.includes(f.project));
});
test('unsupported result is not serialized and leaves an unresolved operation', async t => {
  const f = await fixture(t); let calls = 0;
  await rejects(f.journal.run(f.scope, id, fp, async () => { calls++; return { secret: 'DO_NOT_WRITE_THIS' }; }), 'OPERATION_OUTCOME_UNKNOWN');
  assert.equal((await f.journal.inspect(f.scope, id)).state, 'unresolved');
  assert.ok(!(await contents(f.directory)).includes('DO_NOT_WRITE_THIS'));
  await rejects(f.journal.run(f.scope, id, fp, async () => { calls++; return receipt(); }), 'OPERATION_OUTCOME_UNKNOWN'); assert.equal(calls, 1);
});
test('successful records and directories are owner-only', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, id, fp, async () => receipt());
  const op = await operationDirectory(f.directory);
  for (const p of [f.directory, op]) assert.equal((await lstat(p)).mode & 0o777, 0o700);
  for (const p of [join(f.directory, 'metadata.json'), join(op, 'begin.json'), join(op, 'terminal.json')]) assert.equal((await lstat(p)).mode & 0o777, 0o600);
});
test('capacity is enforced under concurrent allocations and no entries are evicted', async t => {
  const f = await fixture(t, 2); let calls = 0;
  const out = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => f.journal.run(f.scope, `capacity-${i}`, fp, async () => { calls++; return receipt(); })));
  assert.equal(out.filter(r => r.status === 'fulfilled').length, 2); assert.equal(calls, 2);
  for (const r of out) if (r.status === 'rejected') assert.equal(r.reason.code, 'OPERATION_JOURNAL_FULL');
  assert.equal((await readdir(f.directory)).filter(n => n.startsWith('op-')).length, 2);
});
test('unresolved allocation lock blocks new work and is never stolen', async t => {
  const f = await fixture(t); const journal = await DurableMutationJournal.open({ ...f.options, lockWaitMs: 50 });
  const lock = join(f.directory, '.allocation-lock'); await mkdir(lock, { mode: 0o700 });
  await rejects(journal.run(f.scope, id, fp, async () => assert.fail()), 'JOURNAL_ALLOCATION_LOCKED');
  assert.ok((await lstat(lock)).isDirectory());
});
test('a known successful operation can be read while new allocation is locked', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, id, fp, async () => receipt());
  await mkdir(join(f.directory, '.allocation-lock'), { mode: 0o700 });
  assert.equal((await f.journal.run(f.scope, id, fp, async () => assert.fail())).replayed, true);
});
test('missing begin after a claim is unresolved, not a new operation', async t => {
  const f = await fixture(t); const key = createHash('sha256').update(JSON.stringify([f.scope, id])).digest('hex');
  await mkdir(join(f.directory, 'op-' + key), { mode: 0o700 });
  assert.deepEqual(await f.journal.inspect(f.scope, id), { state: 'unresolved', reason: 'invalid_record' });
  await rejects(f.journal.run(f.scope, id, fp, async () => assert.fail()), 'OPERATION_OUTCOME_UNKNOWN');
});
test('truncated terminal is unresolved and never causes an automatic retry', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, id, fp, async () => receipt());
  const op = await operationDirectory(f.directory); await writeFile(join(op, 'terminal.json'), '{');
  assert.deepEqual(await f.journal.inspect(f.scope, id), { state: 'unresolved', reason: 'invalid_record' });
  await rejects(f.journal.run(f.scope, id, fp, async () => assert.fail()), 'OPERATION_OUTCOME_UNKNOWN');
});
test('valid JSON with damaged checksum cannot become a successful replay', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, id, fp, async () => receipt());
  const file = join(await operationDirectory(f.directory), 'terminal.json'); const envelope = JSON.parse(await readFile(file, 'utf8'));
  envelope.payload.receipt.bytes = 99; await writeFile(file, JSON.stringify(envelope));
  assert.equal((await f.journal.inspect(f.scope, id)).state, 'unresolved');
});
test('terminal write failure after a side effect is unknown and not retried', async t => {
  const f = await fixture(t); let calls = 0; let op = '';
  try {
    await rejects(f.journal.run(f.scope, id, fp, async () => { calls++; op = await operationDirectory(f.directory); await chmod(op, 0o500); return receipt(); }), 'OPERATION_OUTCOME_UNKNOWN');
  } finally { if (op) await chmod(op, 0o700); }
  await rejects(f.journal.run(f.scope, id, fp, async () => { calls++; return receipt(); }), 'OPERATION_OUTCOME_UNKNOWN'); assert.equal(calls, 1);
});
test('symlink journal path is rejected without touching target', async t => {
  const f = await fixture(t); const alias = join(f.base, 'alias'); await symlink(f.directory, alias);
  await rejects(DurableMutationJournal.open({ ...f.options, directory: alias }), 'JOURNAL_UNSAFE_DIRECTORY');
});
test('hardlinked and symlinked records are rejected before replay', async t => {
  const f = await fixture(t); await f.journal.run(f.scope, id, fp, async () => receipt());
  const file = join(await operationDirectory(f.directory), 'terminal.json'), copy = join(f.base, 'copy');
  await link(file, copy); await rejects(f.journal.inspect(f.scope, id), 'JOURNAL_UNSAFE_FILE'); await rm(copy);
  await rename(file, copy); await symlink(copy, file); await rejects(f.journal.inspect(f.scope, id), 'JOURNAL_UNSAFE_FILE');
});
test('group-readable store or record is rejected without changing permissions', async t => {
  const f = await fixture(t); await chmod(f.directory, 0o755);
  await rejects(DurableMutationJournal.open(f.options), 'JOURNAL_UNSAFE_DIRECTORY'); assert.equal((await lstat(f.directory)).mode & 0o777, 0o755);
  await chmod(f.directory, 0o700); await chmod(join(f.directory, 'metadata.json'), 0o644);
  await rejects(DurableMutationJournal.open(f.options), 'JOURNAL_UNSAFE_FILE');
});
test('workspace overlap is rejected before a journal directory is created', async t => {
  const f = await fixture(t); const directory = join(f.project, 'state');
  await rejects(DurableMutationJournal.open({ ...f.options, directory }), 'JOURNAL_WORKSPACE_OVERLAP');
  await assert.rejects(lstat(directory), { code: 'ENOENT' });
  await rejects(DurableMutationJournal.open({ ...f.options, directory: f.base }), 'JOURNAL_WORKSPACE_OVERLAP');
});
test('existing empty store is not silently reinitialized', async t => {
  const f = await fixture(t); const directory = join(f.base, 'empty'); await mkdir(directory, { mode: 0o700 });
  await assert.rejects(DurableMutationJournal.open({ ...f.options, directory }), { code: 'ENOENT' }); assert.deepEqual(await readdir(directory), []);
});
test('capacity or root-policy changes require a new reviewed namespace', async t => {
  const f = await fixture(t); await rejects(DurableMutationJournal.open({ ...f.options, capacity: 5 }), 'JOURNAL_CONFIG_MISMATCH');
  const other = join(f.base, 'other'); await mkdir(other); await rejects(DurableMutationJournal.open({ ...f.options, workspaceRoots: [other] }), 'JOURNAL_CONFIG_MISMATCH');
});
test('journal directory replacement is detected by an existing instance', async t => {
  const f = await fixture(t); await rename(f.directory, f.directory + '-old'); await mkdir(f.directory, { mode: 0o700 });
  await rejects(f.journal.inspect(f.scope, id), 'JOURNAL_REPLACED');
});
test('invalid IDs, scopes and hashes do not allocate an operation', async t => {
  const f = await fixture(t);
  for (const fields of [[f.scope, '../illegal', fp], [f.base, id, fp], [f.scope, id, 'bad']]) {
    await rejects(f.journal.run(fields[0], fields[1], fields[2], async () => assert.fail()), 'JOURNAL_INVALID_OPERATION');
  }
  assert.deepEqual(await readdir(f.directory), ['metadata.json']);
});
test('real Workspace edit receipt is restored by another Workspace and journal instance', async t => {
  const f = await fixture(t); await writeFile(join(f.project, 'a.txt'), 'one');
  const ws = new Workspace(f.project, f.journal); const version = await ws.readVersion('a.txt');
  const options = { expectedSha256: version.sha256, operationId: id };
  const first = await ws.editText('a.txt', 'one', 'two', options); assert.equal(first.replayed, false);
  const next = new Workspace(f.project, await DurableMutationJournal.open(f.options));
  const replay = await next.editText('a.txt', 'one', 'two', options); assert.equal(replay.replayed, true);
  assert.equal(await next.read('a.txt'), 'two'); assert.equal(replay.beforeSha256, version.sha256);
});
test('historical receipt replay does not overwrite a later external change', async t => {
  const f = await fixture(t); await writeFile(join(f.project, 'a.txt'), 'one'); const ws = new Workspace(f.project, f.journal);
  const options = { expectedSha256: (await ws.readVersion('a.txt')).sha256, operationId: id };
  await ws.editText('a.txt', 'one', 'two', options); await writeFile(join(f.project, 'a.txt'), 'external-later');
  const next = new Workspace(f.project, await DurableMutationJournal.open(f.options));
  assert.equal((await next.editText('a.txt', 'one', 'two', options)).replayed, true);
  assert.equal(await next.read('a.txt'), 'external-later');
});
test('real Workspace patch receipts retain edit count across reopen', async t => {
  const f = await fixture(t); await writeFile(join(f.project, 'a.txt'), 'one\n'); const ws = new Workspace(f.project, f.journal);
  const version = await ws.readVersion('a.txt'), edits = [{ startLine: 1, endLine: 1, replacement: 'two' }];
  const r = await ws.applyEdits('a.txt', edits, version.sha256, id); assert.equal(r.edits, 1);
  const next = new Workspace(f.project, await DurableMutationJournal.open(f.options));
  assert.equal((await next.applyEdits('a.txt', edits, version.sha256, id)).replayed, true);
});
