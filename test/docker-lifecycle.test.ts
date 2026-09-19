import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, chmod, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runSandboxCheck } from '../src/adapters/docker-snapshot.js';

const check = {image:`sha256:${'a'.repeat(64)}`,executable:'/usr/local/bin/node',args:['--test'],timeoutMs:1000};
const unsupported = process.platform === 'win32' || process.getuid?.() === 0;
async function fixture(t: TestContext, scenario: string) {
  const base=await mkdtemp(join(tmpdir(),'docker-double-')),home=join(base,'home'),project=join(base,'project'),bin=join(base,'bin');
  await mkdir(home);await mkdir(project);await mkdir(bin);await writeFile(join(home,'scenario'),scenario);await writeFile(join(project,'source.mjs'),'safe fixture');
  await copyFile(resolve('test/fixtures/docker-cli-double.mjs'),join(bin,'docker'));await chmod(join(bin,'docker'),0o700);
  const before={PATH:process.env.PATH,HOME:process.env.HOME};process.env.HOME=home;process.env.PATH=bin+':'+before.PATH;
  t.after(async()=>{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
    try{const c=JSON.parse(await readFile(join(home,'fake-container.json'),'utf8'));const p=c.Mounts[0].Source;if(p.includes('localmcp-snapshot-'))await rm(p,{recursive:true,force:true});}catch{}
    await rm(base,{recursive:true,force:true});});
  return {home,project,calls:async()=> (await readFile(join(home,'fake-calls.jsonl'),'utf8')).trim().split('\n').map(l=>JSON.parse(l) as string[])};
}
test('Docker protocol double: create/inspect/start/inspect/remove lifecycle', {skip:unsupported}, async t=>{
  const f=await fixture(t,'ok');const r=await runSandboxCheck(f.project,check);assert.equal(r.exitCode,0);assert.equal(r.cleanupConfirmed,true);assert.equal(r.writeback,false);
  assert.deepEqual((await f.calls()).map(a=>a[0]),['context','image','create','container','start','container','rm']);await assert.rejects(access(join(f.home,'fake-container.json')));
});
test('Docker protocol double: inspection mismatch blocks start and still cleans up', {skip:unsupported}, async t=>{
  const f=await fixture(t,'tampered');await assert.rejects(runSandboxCheck(f.project,check),/CONTAINER_POLICY_MISMATCH/);assert.ok(!(await f.calls()).some(a=>a[0]==='start'));assert.equal((await f.calls()).at(-1)?.[0],'rm');
});
test('Docker protocol double: nonzero container exit is preserved', {skip:unsupported}, async t=>{
  const f=await fixture(t,'test-failed');const r=await runSandboxCheck(f.project,check);assert.equal(r.exitCode,7);assert.equal(r.cleanupConfirmed,true);
});
test('Docker protocol double: timeout kills client then removes its owned container', {skip:unsupported}, async t=>{
  const f=await fixture(t,'timeout');const r=await runSandboxCheck(f.project,{...check,timeoutMs:100});assert.equal(r.timedOut,true);assert.equal(r.exitCode,null);assert.equal(r.cleanupConfirmed,true);
});
test('Docker protocol double: unresolved running state is not successful', {skip:unsupported}, async t=>{
  const f=await fixture(t,'unknown');await assert.rejects(runSandboxCheck(f.project,check),/CONTAINER_OUTCOME_UNKNOWN/);assert.equal((await f.calls()).at(-1)?.[0],'rm');
});
test('Docker protocol double: cleanup failure is explicit and includes only owned name', {skip:unsupported}, async t=>{
  const f=await fixture(t,'cleanup-failed');await assert.rejects(runSandboxCheck(f.project,check),/CLEANUP_UNCONFIRMED.*localmcp-check-/);
});
test('Docker protocol double: remote context and absent image fail before creating a container', {skip:unsupported}, async t=>{
  const f=await fixture(t,'remote');await assert.rejects(runSandboxCheck(f.project,check),/LOCAL_DOCKER_REQUIRED/);
  await writeFile(join(f.home,'scenario'),'missing-image');await assert.rejects(runSandboxCheck(f.project,check),/DOCKER_INSPECTION_FAILED/);assert.ok(!(await f.calls()).some(a=>a[0]==='create'));
});
