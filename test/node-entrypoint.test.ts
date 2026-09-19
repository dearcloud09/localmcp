import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync, fork } from 'node:child_process';
import { nodeEntrypoint } from './helpers/node-entrypoint.js';

test('source tests select the real .ts file and explicit tsx loader', () => {
  const parent = pathToFileURL(join(tmpdir(), 'entry test', 'suite.ts')).href;
  const result = nodeEntrypoint('./fixture.js', parent);
  assert.equal(result.path, join(tmpdir(), 'entry test', 'fixture.ts'));
  assert.deepEqual(result.execArgv, ['--import', 'tsx']);
});
test('compiled tests select emitted JavaScript without an inherited test loader', () => {
  const parent = pathToFileURL(join(tmpdir(), 'entry test', 'suite.js')).href;
  const result = nodeEntrypoint('./fixture.js', parent);
  assert.equal(result.path, join(tmpdir(), 'entry test', 'fixture.js'));
  assert.deepEqual(result.execArgv, []);
});
test('encoded spaces and unicode are decoded exactly once', () => {
  const result = nodeEntrypoint('../src/child.js', pathToFileURL(join(tmpdir(), '한글 % space', 'test', 'suite.ts')).href);
  assert.equal(result.path, join(tmpdir(), '한글 % space', 'src', 'child.ts'));
});
test('URL parameters, remote URLs and ambiguous extensions are rejected', () => {
  const parent = pathToFileURL(join(tmpdir(), 'suite.ts')).href;
  for (const relative of ['https://example.com/a.js', '/absolute.js', './a.js?x', './a.js#x', './a.ts', './a\0.js']) assert.throws(() => nodeEntrypoint(relative, parent), /INVALID_TEST_ENTRYPOINT/);
  for (const importer of ['https://example.com/a.ts', pathToFileURL(join(tmpdir(), 'suite.mjs')).href]) assert.throws(() => nodeEntrypoint('./a.js', importer), /INVALID_TEST_ENTRYPOINT/);
});
test('compiled mode never silently changes to an available TypeScript source', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'entry-missing-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'child.ts'), 'process.exitCode = 0;');
  const result = nodeEntrypoint('./child.js', pathToFileURL(join(directory, 'suite.js')).href);
  const child = spawnSync(process.execPath, [...result.execArgv, result.path], { encoding: 'utf8', timeout: 5000 });
  assert.notEqual(child.status, 0); assert.match(child.stderr, /MODULE_NOT_FOUND/);
});
test('compiled entry actually executes a child with literal arguments', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'entry spaces ')); t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'child.js'), "process.stdout.write(process.argv[2]);");
  const result = nodeEntrypoint('./child.js', pathToFileURL(join(directory, 'suite.js')).href);
  const child = spawnSync(process.execPath, [...result.execArgv, result.path, 'a b;literal'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, 'a b;literal');
});
test('compiled entry preserves actual fork IPC', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'entry-ipc-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'child.js'), "process.send({phase:'ready'});process.disconnect();");
  const result = nodeEntrypoint('./child.js', pathToFileURL(join(directory, 'suite.js')).href);
  const child = fork(result.path, [], { execArgv: result.execArgv, silent: true });
  const messages: unknown[] = []; child.on('message', m => messages.push(m));
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  const code = await new Promise<number | null>((done, reject) => { child.once('error', reject); child.once('close', done); }); clearTimeout(timer);
  assert.equal(code, 0); assert.deepEqual(messages, [{ phase: 'ready' }]);
});
test('all three original broken launch targets resolve to actual source or output files', async () => {
  for (const relative of ['./fixtures/durable-child.js', './fixtures/runtime-journal-child.js', '../src/recovery-inspect.js']) {
    const result = nodeEntrypoint(relative, import.meta.url); await access(result.path);
  }
});
