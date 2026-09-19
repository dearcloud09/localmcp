import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { MutationQueue, MutationJournal } from '../src/core/mutation-coordinator.js';

const a = resolve('fixture/a'), b = resolve('fixture/b');
const tick = () => new Promise<void>(done => setImmediate(done));
function latch() { let release!: () => void; return { promise: new Promise<void>(done => { release = done; }), release: () => release() }; }
const hash = 'a'.repeat(64);

test('queue serializes conflicting paths across callers', async () => {
  const q = new MutationQueue(), hold = latch(), order: number[] = [];
  const first = q.run([a], async () => { order.push(1); await hold.promise; order.push(2); });
  const second = q.run([a], async () => { order.push(3); });
  await tick(); assert.deepEqual(order, [1]); hold.release(); await Promise.all([first, second]); assert.deepEqual(order, [1, 2, 3]);
});
test('unrelated files are not serialized behind a long operation', async () => {
  const q = new MutationQueue(), hold = latch(); let second = false;
  const first = q.run([a], async () => hold.promise);
  await q.run([b], async () => { second = true; }); assert.equal(second, true); hold.release(); await first;
});
test('ancestor locks prevent descendant changes', async () => {
  const q = new MutationQueue(), hold = latch(); let ran = false;
  const first = q.run([a], async () => hold.promise);
  const second = q.run([resolve(a, 'child')], async () => { ran = true; });
  await tick(); assert.equal(ran, false); hold.release(); await Promise.all([first, second]); assert.equal(ran, true);
});
test('descendant locks also prevent ancestor renames', async () => {
  const q = new MutationQueue(), hold = latch(); let ran = false;
  const first = q.run([resolve(a, 'child')], async () => hold.promise);
  const second = q.run([a, b], async () => { ran = true; });
  await tick(); assert.equal(ran, false); hold.release(); await Promise.all([first, second]);
});
test('path prefixes are not ancestor relations', async () => {
  const q = new MutationQueue(), hold = latch(); const first = q.run([a], async () => hold.promise);
  await q.run([a + '-other'], async () => {}); hold.release(); await first;
});
test('a thrown action releases its locks', async () => {
  const q = new MutationQueue();
  const first = q.run([a], async () => { throw new Error('failed'); });
  const second = q.run([a], async () => 2);
  await assert.rejects(first, /failed/); assert.equal(await second, 2);
});
test('conflicting queued requests stay FIFO and cannot starve an ancestor', async () => {
  const q = new MutationQueue(), hold = latch(), order: number[] = [];
  const first = q.run([resolve(a, 'x')], async () => hold.promise);
  const parent = q.run([a], async () => { order.push(1); });
  const child = q.run([resolve(a, 'y')], async () => { order.push(2); });
  await tick(); assert.deepEqual(order, []); hold.release(); await Promise.all([first, parent, child]); assert.deepEqual(order, [1, 2]);
});
test('two-path operations in reverse order do not deadlock', async () => {
  const q = new MutationQueue(); assert.deepEqual(await Promise.all([q.run([a, b], async () => 1), q.run([b, a], async () => 2)]), [1, 2]);
});
test('queue capacity rejects new work instead of discarding pending work', async () => {
  const q = new MutationQueue(1), hold = latch(); let ran = false;
  const first = q.run([a], async () => hold.promise);
  await assert.rejects(q.run([b], async () => { ran = true; }), /MUTATION_QUEUE_FULL/);
  assert.equal(ran, false); hold.release(); await first;
});
test('invalid paths and capacities are rejected', async () => {
  const q = new MutationQueue();
  for (const paths of [[], ['relative'], [a + '\0']]) await assert.rejects(q.run(paths, async () => {}), /INVALID_MUTATION_PATH/);
  assert.throws(() => new MutationQueue(0)); assert.throws(() => new MutationJournal(-1));
});
test('concurrent duplicate IDs execute once and return distinct replay markers', async () => {
  const journal = new MutationJournal(), hold = latch(); let calls = 0;
  const action = async () => { calls++; await hold.promise; return { bytes: 3 }; };
  const first = journal.run(a, 'operation1', hash, action), second = journal.run(a, 'operation1', hash, action);
  await tick(); assert.equal(calls, 1); hold.release();
  const results = await Promise.all([first, second]); assert.deepEqual(results.map(v => v.replayed), [false, true]); assert.equal(calls, 1);
});
test('same operation ID with a different payload is refused before action', async () => {
  const journal = new MutationJournal(); await journal.run(a, 'operation1', hash, async () => 1);
  await assert.rejects(journal.run(a, 'operation1', 'b'.repeat(64), async () => assert.fail()), /OPERATION_ID_CONFLICT/);
});
test('journal scopes do not share operation IDs', async () => {
  const journal = new MutationJournal(); let count = 0;
  await journal.run(a, 'operation1', hash, async () => ++count); await journal.run(b, 'operation1', hash, async () => ++count); assert.equal(count, 2);
});
test('retained receipts cannot be mutated by callers', async () => {
  const journal = new MutationJournal(); const first = await journal.run(a, 'operation1', hash, async () => ({ bytes: 3 }));
  first.value.bytes = 999;
  assert.equal((await journal.run<{ bytes: number }>(a, 'operation1', hash, async () => assert.fail())).value.bytes, 3);
});
test('failed operations reserve their IDs and are not retried', async () => {
  const journal = new MutationJournal(); let count = 0;
  await assert.rejects(journal.run(a, 'operation1', hash, async () => { count++; throw new Error('private error detail'); }), /private error/);
  await assert.rejects(journal.run(a, 'operation1', hash, async () => { count++; }), /OPERATION_PREVIOUSLY_FAILED/); assert.equal(count, 1);
});
test('journal saturation preserves old IDs rather than evicting and replaying', async () => {
  const journal = new MutationJournal(1); await journal.run(a, 'operation1', hash, async () => 1);
  await assert.rejects(journal.run(a, 'operation2', hash, async () => 2), /OPERATION_JOURNAL_FULL/);
  assert.equal((await journal.run(a, 'operation1', hash, async () => assert.fail())).replayed, true);
});
test('malformed operation IDs and fingerprints never execute', async () => {
  const journal = new MutationJournal();
  for (const id of ['', 'short', 'x'.repeat(129), 'bad/token', 'spaces id']) await assert.rejects(journal.run(a, id, hash, async () => assert.fail()), /INVALID_OPERATION/);
  await assert.rejects(journal.run(a, 'operation1', 'bad', async () => assert.fail()), /INVALID_OPERATION/);
});

test('journal snapshots action-owned receipts before retaining them', async () => {
  const journal = new MutationJournal(), value = { bytes: 3 };
  await journal.run(a, 'operation1', hash, async () => value); value.bytes = 999;
  assert.equal((await journal.run<{ bytes: number }>(a, 'operation1', hash, async () => assert.fail())).value.bytes, 3);
});
