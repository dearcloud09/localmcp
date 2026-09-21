import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Workspace } from '../src/workspace.js';
import { ProcessManager } from '../src/process.js';

async function temp(t: TestContext) { const root = await mkdtemp(join(tmpdir(), 'localmcp-m1-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }
async function waitFor(predicate: () => boolean, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Condition did not become true'); await new Promise(r => setTimeout(r, 20)); }
}

test('overwrite preserves executable permissions and removes no unrelated files', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t), ws = new Workspace(root), file = join(root, 'run.sh');
  await writeFile(file, '#!/bin/sh\necho old\n'); await chmod(file, 0o755);
  await ws.write('run.sh', '#!/bin/sh\necho new\n', true);
  assert.equal((await stat(file)).mode & 0o777, 0o755); assert.match(await readFile(file, 'utf8'), /new/);
  assert.deepEqual(await readdir(root), ['run.sh']);
});
test('overwrite also preserves non-executable permission bits', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t), ws = new Workspace(root), file = join(root, 'data.txt');
  await writeFile(file, 'old'); await chmod(file, 0o640); await ws.write('data.txt', 'new', true);
  assert.equal((await stat(file)).mode & 0o777, 0o640);
});
test('new files retain private defaults', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t), ws = new Workspace(root); await ws.write('new.txt', 'new', false);
  assert.equal((await stat(join(root, 'new.txt'))).mode & 0o077, 0);
});
test('hash conflicts fail without modifying the file', async t => {
  const root = await temp(t), ws = new Workspace(root); await ws.write('a.txt', 'one\ntwo', false);
  const hash = createHash('sha256').update('one\ntwo').digest('hex');
  await ws.write('a.txt', 'external\ntwo', true);
  await assert.rejects(ws.applyEdits('a.txt', [{ startLine: 1, endLine: 1, replacement: 'bad' }], hash), /mismatch/);
  assert.equal(await ws.read('a.txt'), 'external\ntwo');
});
test('patch application preserves executable permissions', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t), ws = new Workspace(root); await ws.write('script', 'one\ntwo', false); await chmod(join(root, 'script'), 0o755);
  await ws.applyEdits('script', [{ startLine: 2, endLine: 2, replacement: 'TWO' }]);
  assert.equal((await stat(join(root, 'script'))).mode & 0o777, 0o755); assert.equal(await ws.read('script'), 'one\nTWO');
});
test('existing path escape, symlink and hardlink protections remain intact', { skip: process.platform === 'win32' }, async t => {
  const root = await temp(t), outside = await temp(t), ws = new Workspace(root);
  await writeFile(join(outside, 'keep'), 'keep'); await link(join(outside, 'keep'), join(root, 'hard')); await symlink(outside, join(root, 'escape'));
  await assert.rejects(ws.write('hard', 'bad', true)); await assert.rejects(ws.write('escape/keep', 'bad', true)); await assert.rejects(ws.read('../keep'));
  assert.equal(await readFile(join(outside, 'keep'), 'utf8'), 'keep');
});
test('process manager collects real split UTF-8 stdout and separate stderr', async t => {
  const root = await temp(t), pm = new ProcessManager(); t.after(() => pm.close());
  const script = join(root, 'split.cjs');
  await writeFile(script, "const b=Buffer.from('가🙂');process.stdout.write(b.subarray(0,1));setTimeout(()=>{process.stdout.write(b.subarray(1));process.stderr.write('오류아님');},30);");
  const started = pm.start(`${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`, root);
  await waitFor(() => !pm.read(started.processId).running);
  const output = pm.read(started.processId); assert.equal(output.stdout, '가🙂'); assert.equal(output.stderr, '오류아님'); assert.equal(output.exitCode, 0);
});
test('asynchronous spawn failures are contained and not permanently running', async t => {
  const root = await temp(t), pm = new ProcessManager(); t.after(() => pm.close());
  const started = pm.start('ignored-command', join(root, 'missing'));
  await waitFor(() => !pm.read(started.processId).running);
  assert.match(pm.read(started.processId).error ?? '', /ENOENT/);
  assert.equal(pm.list()[0].running, false);
});
test('persistent process stdin and stop still work', async t => {
  const root = await temp(t), pm = new ProcessManager(); t.after(() => pm.close());
  const script = join(root, 'echo.cjs'); await writeFile(script, "process.stdin.on('data',x=>process.stdout.write(x));");
  const started = pm.start(`${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`, root);
  pm.write(started.processId, 'echo\n'); await waitFor(() => pm.read(started.processId).stdout === 'echo\n');
  pm.stop(started.processId); await waitFor(() => !pm.read(started.processId).running);
});

test('a child exiting during stdin writes does not emit an unhandled EPIPE', async t => {
  const root = await temp(t), pm = new ProcessManager(); t.after(() => pm.close());
  const script = join(root, 'exit.cjs'); await writeFile(script, 'process.exit(0);');
  for (let i = 0; i < 3; i++) {
    const started = pm.start(`${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`, root);
    pm.write(started.processId, 'x'.repeat(1024 * 1024));
    await waitFor(() => !pm.read(started.processId).running);
  }
});
