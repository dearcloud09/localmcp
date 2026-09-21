import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, readdir, realpath, rm, writeFile, stat, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Workspace } from '../src/workspace.js';
import { fileMutationQueue } from '../src/core/mutation-coordinator.js';

const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const tick = () => new Promise<void>(done => setImmediate(done));
async function fixture(t: TestContext, source = 'alpha beta\n') {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-concurrent-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'source.txt'), source); return { root, ws: new Workspace(root) };
}

test('readVersion hashes exact UTF-8 bytes including BOM and CRLF', async t => {
  const source = '\ufeff가🙂\r\n'; const { ws } = await fixture(t, source); const v = await ws.readVersion('source.txt');
  assert.equal(v.content, source); assert.equal(v.sha256, hash(Buffer.from(source))); assert.equal(v.bytes, Buffer.byteLength(source));
  assert.equal((await ws.readLines('source.txt', 1, 1)).content, source.split('\n')[0]);
});
test('invalid UTF-8 is rejected without silently replacing bytes', async t => {
  const { root, ws } = await fixture(t); const bytes = Buffer.from([0x61, 0xff]); await writeFile(join(root, 'source.txt'), bytes);
  await assert.rejects(ws.editText('source.txt', 'a', 'b'), /INVALID_UTF8/); assert.deepEqual(await readFile(join(root, 'source.txt')), bytes);
});
test('same-revision competing patches have exactly one winner', async t => {
  const { root, ws } = await fixture(t, 'old\n'); const other = new Workspace(root);
  const results = await Promise.allSettled([ws.applyEdits('source.txt', [{ startLine: 1, endLine: 1, replacement: 'one' }], hash('old\n')),
    other.applyEdits('./source.txt', [{ startLine: 1, endLine: 1, replacement: 'two' }], hash('old\n'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult; assert.match(failed.reason.message, /FILE_VERSION_CONFLICT/);
  assert.ok(['one\n', 'two\n'].includes(await ws.read('source.txt')));
});
test('legacy text edits on different tokens keep both changes', async t => {
  const { root, ws } = await fixture(t); await Promise.all([ws.editText('source.txt', 'alpha', 'A'), new Workspace(root).editText('source.txt', 'beta', 'B')]);
  assert.equal(await ws.read('source.txt'), 'A B\n');
});
test('same operation replays its receipt without applying a self-matching edit twice', async t => {
  const { ws } = await fixture(t, 'a'); const options = { expectedSha256: hash('a'), operationId: 'op-replay-0001' };
  const first = await ws.editText('source.txt', 'a', 'aa', options); const second = await ws.editText('./source.txt', 'a', 'aa', options);
  assert.equal('replayed' in first && first.replayed, false); assert.equal('replayed' in second && second.replayed, true);
  assert.equal(await ws.read('source.txt'), 'aa');
});
test('parallel identical operations across Workspace instances execute once', async t => {
  const { root, ws } = await fixture(t, 'a'); const options = { expectedSha256: hash('a'), operationId: 'op-parallel-0001' };
  const results = await Promise.all(Array.from({ length: 20 }, () => new Workspace(root).editText('source.txt', 'a', 'aa', options)));
  assert.equal(results.filter(r => 'replayed' in r && r.replayed === false).length, 1); assert.equal(await ws.read('source.txt'), 'aa');
});
test('operation ID reuse for different edit payload or path is rejected', async t => {
  const { ws } = await fixture(t, 'a'); const options = { expectedSha256: hash('a'), operationId: 'op-conflict-0001' };
  await ws.editText('source.txt', 'a', 'aa', options);
  await assert.rejects(ws.editText('source.txt', 'a', 'bb', options), /OPERATION_ID_CONFLICT/);
  await ws.write('second.txt', 'a', false); await assert.rejects(ws.editText('second.txt', 'a', 'aa', options), /OPERATION_ID_CONFLICT/);
});
test('replay is historical acknowledgement and does not undo a later edit', async t => {
  const { ws } = await fixture(t, 'a'); const options = { expectedSha256: hash('a'), operationId: 'op-history-0001' };
  await ws.editText('source.txt', 'a', 'aa', options); await ws.editText('source.txt', 'aa', 'later');
  const replay = await ws.editText('source.txt', 'a', 'aa', options); assert.equal(replay.afterSha256, hash('aa')); assert.equal(await ws.read('source.txt'), 'later');
});
test('failed operation ID remains failed after file state becomes suitable', async t => {
  const { ws } = await fixture(t, 'a'); const options = { expectedSha256: hash('a'), operationId: 'op-failed-0001' };
  await assert.rejects(ws.editText('source.txt', 'missing', 'b', options), /exactly once/);
  await ws.write('source.txt', 'missing', true); await assert.rejects(ws.editText('source.txt', 'missing', 'b', options), /OPERATION_PREVIOUSLY_FAILED/);
  assert.equal(await ws.read('source.txt'), 'missing');
});
test('operation ID requires a hash, and stale hashes preserve the file', async t => {
  const { ws } = await fixture(t);
  await assert.rejects(ws.editText('source.txt', 'alpha', 'A', { operationId: 'op-needs-hash' }), /REQUIRES_EXPECTED/);
  await assert.rejects(ws.editText('source.txt', 'alpha', 'A', { expectedSha256: 'invalid' }), /INVALID_EXPECTED/);
  await assert.rejects(ws.editText('source.txt', 'alpha', 'A', { expectedSha256: hash('stale') }), /FILE_VERSION_CONFLICT/);
  assert.equal(await ws.read('source.txt'), 'alpha beta\n');
});
test('apply_patch deduplication also prevents repeating a patch', async t => {
  const { ws } = await fixture(t, 'old\n'); const edits = [{ startLine: 1, endLine: 1, replacement: 'new' }];
  await ws.applyEdits('source.txt', edits, hash('old\n'), 'op-patch-0001');
  const replay = await ws.applyEdits('source.txt', edits, hash('old\n'), 'op-patch-0001');
  assert.equal('replayed' in replay && replay.replayed, true); assert.equal(await ws.read('source.txt'), 'new\n');
});
test('external edit detected at pre-rename check leaves external content and cleans temp', async t => {
  const { root } = await fixture(t);
  class ExternalChange extends Workspace {
    reads = 0;
    override async readVersion(path: string) {
      if (++this.reads === 2) await writeFile(join(this.root, path), 'external\n');
      return super.readVersion(path);
    }
  }
  await assert.rejects(new ExternalChange(root).editText('source.txt', 'alpha', 'A'), /FILE_VERSION_CONFLICT/);
  assert.equal(await readFile(join(root, 'source.txt'), 'utf8'), 'external\n'); assert.deepEqual(await readdir(root), ['source.txt']);
});
test('checked edits preserve executable mode', { skip: process.platform === 'win32' }, async t => {
  const { root, ws } = await fixture(t); await chmod(join(root, 'source.txt'), 0o755);
  await ws.editText('source.txt', 'alpha', 'A'); assert.equal((await stat(join(root, 'source.txt'))).mode & 0o777, 0o755);
});
test('ordinary writes respect the same process-local mutation queue', async t => {
  const { root, ws } = await fixture(t); let release!: () => void;
  const held = fileMutationQueue.run([join(root, 'source.txt')], () => new Promise<void>(r => { release = r; }));
  await tick(); let wrote = false; const write = ws.write('source.txt', 'new', true).then(() => { wrote = true; });
  await tick(); await tick(); assert.equal(wrote, false); release(); await Promise.all([held, write]); assert.equal(await ws.read('source.txt'), 'new');
});
test('concurrent creates sharing missing parents both succeed', async t => {
  const { ws } = await fixture(t);
  await Promise.all([ws.write('nested/deep/a', 'a', false), ws.write('nested/deep/b', 'b', false)]);
  assert.equal(await ws.read('nested/deep/a'), 'a'); assert.equal(await ws.read('nested/deep/b'), 'b');
});
test('sensitive paths and links remain blocked in guarded editing', async t => {
  const { root, ws } = await fixture(t); await writeFile(join(root, '.env'), 'secret');
  await assert.rejects(ws.editText('.env', 'secret', 'new'), /SENSITIVE_PATH/);
  await symlink(join(root, 'source.txt'), join(root, 'alias')); await assert.rejects(ws.editText('alias', 'alpha', 'A'), /Symbolic/);
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'secret');
});
test('directory move/delete retain protected-descendant preflight', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, 'folder')); await writeFile(join(root, 'folder', '.env'), 'secret');
  await assert.rejects(ws.move('folder', 'moved', false), /SENSITIVE_PATH/); await assert.rejects(ws.delete('folder', true), /SENSITIVE_PATH/);
  assert.equal(await readFile(join(root, 'folder', '.env'), 'utf8'), 'secret');
});
test('oversized and invalid edits do not leave partial changes', async t => {
  const { root, ws } = await fixture(t);
  await assert.rejects(ws.editText('source.txt', 'alpha', 'x'.repeat(1048577)), /1 MiB/);
  await assert.rejects(ws.applyEdits('source.txt', [{ startLine: 1.1, endLine: 1, replacement: 'x' }]), /Invalid edit/);
  assert.equal(await ws.read('source.txt'), 'alpha beta\n'); assert.deepEqual(await readdir(root), ['source.txt']);
});

test('queued patch snapshots caller-owned edit objects before execution', async t => {
  const { root, ws } = await fixture(t, 'old\n'); let release!: () => void;
  const held = fileMutationQueue.run([join(root, 'source.txt')], () => new Promise<void>(r => { release = r; })); await tick();
  const edits = [{ startLine: 1, endLine: 1, replacement: 'new' }];
  const pending = ws.applyEdits('source.txt', edits, hash('old\n'), 'op-snapshot-0001');
  edits[0].replacement = 'MUTATED'; release(); await Promise.all([held, pending]);
  assert.equal(await ws.read('source.txt'), 'new\n');
});
