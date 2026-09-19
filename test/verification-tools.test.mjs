import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isolatedEnvironment, runProcess, runStages, atomicReport } from '../scripts/lib/verification.mjs';
import { makeFixture, RED_SOURCE, GREEN_SOURCE, TEST_SOURCE, assertSourceOnlyChange } from '../scripts/lib/minimum-fixture.mjs';
async function fixture(t) { const root = await mkdtemp(join(tmpdir(), 'verification ')); t.after(() => rm(root, { recursive: true, force: true })); const home = join(root, 'home'); await mkdir(home); return { root, home, env: isolatedEnvironment(home) }; }
test('environment strips runtime overrides, Node test IPC and credentials', () => {
  const env = isolatedEnvironment('/tmp/home', { PATH: '/bin', LOCALMCP_ROOT: '/wrong', NODE_TEST_CONTEXT: 'child-v8', NODE_OPTIONS: '--inspect', TOKEN: 'secret', DOCKER_HOST: 'tcp://remote' });
  assert.equal(env.PATH, '/bin'); for (const key of ['LOCALMCP_ROOT','NODE_TEST_CONTEXT','NODE_OPTIONS','TOKEN','DOCKER_HOST']) assert.equal(env[key], undefined);
});
test('tooling argv is literal and stdout/stderr remain separate', async t => {
  const f = await fixture(t); const r = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1]);process.stderr.write("err")', ';$(not-run)'], { cwd: f.root, env: f.env });
  assert.equal(r.reason, null); assert.equal(r.stdout, ';$(not-run)'); assert.equal(r.stderr, 'err');
});
test('missing executable produces a launch failure rather than success', async t => {
  const f = await fixture(t); const r = await runProcess(join(f.root, 'missing'), [], { cwd: f.root, env: f.env }); assert.equal(r.reason, 'launch_failed');
});
test('timeout is a failed outcome', async t => {
  const f = await fixture(t); const r = await runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: f.root, env: f.env, timeoutMs: 100 }); assert.equal(r.reason, 'timeout');
});
test('output cap cannot be mistaken for a passing command', async t => {
  const f = await fixture(t); const r = await runProcess(process.execPath, ['-e', 'process.stdout.write("가".repeat(5000))'], { cwd: f.root, env: f.env, maxBytes: 101 });
  assert.equal(r.reason, 'output_limit'); assert.doesNotMatch(r.stdout, /\ufffd/); assert.ok(Buffer.byteLength(r.stdout) <= 101);
});
test('pre-cancelled run never creates a child side effect', async t => {
  const f = await fixture(t); const c = new AbortController(); c.abort(); const marker = join(f.root, 'marker');
  const r = await runProcess(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'x')`], { cwd: f.root, env: f.env, signal: c.signal });
  assert.equal(r.reason, 'cancelled'); await assert.rejects(access(marker));
});
test('stage failure stops the sequence and stores the actual failure', async t => {
  const f = await fixture(t); const marker = join(f.root, 'not-run');
  const r = await runStages([{ id: 'first', command: process.execPath, args: ['-e', 'process.exit(7)'] }, { id: 'second', command: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'x')`] }], { directory: f.root, cwd: f.root, env: f.env });
  assert.equal(r.status, 'failed'); assert.equal(r.stages.length, 1); assert.equal(r.stages[0].exitCode, 7); await assert.rejects(access(marker));
  assert.equal(JSON.parse(await readFile(join(f.root,'report.json'),'utf8')).status, 'failed');
});
test('successful stages persist their own receipts and private logs', async t => {
  const f = await fixture(t); const r = await runStages([{ id: 'real-node', command: process.execPath, args: ['-e', 'console.log("actual-child")'] }], { directory: f.root, cwd: f.root, env: f.env });
  assert.equal(r.status, 'passed'); assert.equal(r.stages[0].status, 'passed'); assert.match(await readFile(join(f.root,'real-node.log'),'utf8'), /actual-child/);
  if (process.platform !== 'win32') assert.equal((await stat(join(f.root,'real-node.log'))).mode & 0o777, 0o600);
});
test('reports retain unfinished as unfinished instead of inventing success', async t => {
  const f = await fixture(t); await atomicReport(join(f.root,'report.json'), {status:'running',stages:[{id:'test',status:'running'}]});
  assert.equal(JSON.parse(await readFile(join(f.root,'report.json'),'utf8')).status,'running');
});
test('unsafe or duplicate stage names are rejected before executing', async t => {
  const f = await fixture(t); await assert.rejects(runStages([{id:'../escape'}],{directory:f.root})); await assert.rejects(runStages([{id:'same'},{id:'same'}],{directory:f.root}));
});
test('real generated fixture fails three tests, passes after source-only edit, tests remain unchanged', async t => {
  const f = await makeFixture(); t.after(() => rm(f.base,{recursive:true,force:true})); const env = isolatedEnvironment(f.home);
  assert.equal(await readFile(join(f.project,'calculator.mjs'),'utf8'),RED_SOURCE);
  const before = await runProcess(process.execPath,['--test','calculator.test.mjs'],{cwd:f.project,env}); assert.equal(before.exitCode,1); assert.match(before.stdout,/fail 3\b/);
  await writeFile(join(f.project,'calculator.mjs'),GREEN_SOURCE);
  const after = await runProcess(process.execPath,['--test','calculator.test.mjs'],{cwd:f.project,env}); assert.equal(after.exitCode,0); assert.match(after.stdout,/pass 3\b/);
  await assertSourceOnlyChange(f); assert.equal(await readFile(join(f.project,'calculator.test.mjs'),'utf8'),TEST_SOURCE);
});
