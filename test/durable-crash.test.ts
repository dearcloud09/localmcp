import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeEntrypoint } from './helpers/node-entrypoint.js';
import { fork } from 'node:child_process';
import { DurableMutationJournal } from '../src/core/durable-mutation-journal.js';
import { mutationPath } from '../src/core/mutation-coordinator.js';
const fixtureScript = nodeEntrypoint('./fixtures/durable-child.js', import.meta.url);
async function setup(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp crash '))), project = join(base, 'project'), directory = join(base, 'journal');
  await mkdir(project, { mode: 0o700 }); await writeFile(join(project, 'effects.txt'), '');
  const options = { directory, workspaceRoots: [project] }; await DurableMutationJournal.open(options);
  t.after(() => rm(base, { recursive: true, force: true }));
  return { base, directory, project, options, scope: mutationPath(project) };
}
function child(t: TestContext, f: Awaited<ReturnType<typeof setup>>, phase: string, id = 'crash-operation-01') {
  const c = fork(fixtureScript.path, [f.directory, f.project, id, phase], { silent: true, execArgv: fixtureScript.execArgv,
    env: { PATH: process.env.PATH, HOME: f.base, LANG: 'C.UTF-8' } });
  let stdout = '', stderr = ''; const phases = new Set<string>();
  c.stdout!.on('data', d => { stdout += d; }); c.stderr!.on('data', d => { stderr += d; });
  c.on('message', m => { phases.add((m as { phase: string }).phase); });
  const done = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => { c.once('error', reject); c.once('close', (code, signal) => resolve({ code, signal })); });
  const timer = setTimeout(() => c.kill('SIGKILL'), 10000);
  t.after(async () => { clearTimeout(timer); if (c.exitCode === null && c.signalCode === null) c.kill('SIGKILL'); await done; });
  const reached = async () => {
    for (let i = 0; i < 500; i++) { if (phases.has(phase)) return; if (c.exitCode !== null) assert.fail(stderr); await new Promise(r => setTimeout(r, 10)); }
    assert.fail('child did not reach checkpoint: ' + stderr);
  };
  return { c, done, reached, output: () => ({ stdout, stderr }) };
}
for (const phase of ['before', 'after', 'committed']) {
  test(`actual SIGKILL at ${phase} checkpoint, reopen, and retry in another process`, { timeout: 20000 }, async t => {
    const f = await setup(t), c = child(t, f, phase); await c.reached(); c.c.kill('SIGKILL');
    assert.equal((await c.done).signal, 'SIGKILL');
    const count = phase === 'before' ? '' : 'effect\n'; assert.equal(await readFile(join(f.project, 'effects.txt'), 'utf8'), count);
    const next = await DurableMutationJournal.open(f.options), state = await next.inspect(f.scope, 'crash-operation-01');
    assert.equal(state.state, phase === 'committed' ? 'succeeded' : 'unresolved');
    const retry = child(t, f, 'normal'), ended = await retry.done;
    if (phase === 'committed') { assert.equal(ended.code, 0, retry.output().stderr); assert.equal(JSON.parse(retry.output().stdout).replayed, true); }
    else { assert.equal(ended.code, 2); assert.match(retry.output().stderr, /OPERATION_OUTCOME_UNKNOWN/); }
    assert.equal(await readFile(join(f.project, 'effects.txt'), 'utf8'), count);
  });
}
test('six separate Node processes reserve one shared operation and produce one side effect', { timeout: 20000 }, async t => {
  const f = await setup(t), children = Array.from({ length: 6 }, () => child(t, f, 'normal'));
  const results = await Promise.all(children.map(c => c.done));
  assert.ok(results.some(r => r.code === 0));
  results.forEach((r, i) => { assert.ok(r.code === 0 || r.code === 2, children[i].output().stderr); if (r.code === 2) assert.match(children[i].output().stderr, /OPERATION_OUTCOME_UNKNOWN/); });
  assert.equal(await readFile(join(f.project, 'effects.txt'), 'utf8'), 'effect\n');
  assert.equal((await (await DurableMutationJournal.open(f.options)).inspect(f.scope, 'crash-operation-01')).state, 'succeeded');
});
