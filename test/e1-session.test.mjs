import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareSession, verifySession, sessionEnvironment } from '../scripts/e1-session.mjs';
import { DEMO_FILES } from '../scripts/lib/project-profile.mjs';
async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'e1-session ')); t.after(() => rm(parent, { recursive: true, force: true }));
  const directory = join(parent, 'session'); await prepareSession(directory);
  const state = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'));
  return { parent, directory, state };
}
const fix = f => writeFile(join(f.state.workspace, 'calculator.mjs'), DEMO_FILES['calculator.mjs'].replace('return a - b', 'return a + b'));
test('prepare is local, red, create-only and protects an existing session', async t => {
  const f = await fixture(t); const before = await readFile(join(f.directory, 'session.json'));
  await assert.rejects(prepareSession(f.directory), { code: 'EEXIST' });
  assert.deepEqual(await readFile(join(f.directory, 'session.json')), before);
  await assert.rejects(readFile(join(f.state.home, '.localmcp', 'worker.json')), { code: 'ENOENT' });
});
test('red fixture cannot be reported as passing', async t => {
  const f = await fixture(t); await assert.rejects(verifySession(f.directory), /E1_SOURCE_NOT_EXPECTED/);
});
test('exact source-only edit passes real Node tests without attributing the actor', async t => {
  const f = await fixture(t); await fix(f); const result = await verifySession(f.directory);
  assert.equal(result.status, 'E1_LOCAL_CHECK_OK'); assert.equal(result.pass, 3); assert.equal(result.chatgptActorVerified, false);
  assert.equal(result.challenge, (await readFile(join(f.state.workspace, 'E1_CHALLENGE.txt'), 'utf8')).trim());
});
test('test edits and added files are rejected', async t => {
  const f = await fixture(t); await fix(f); await writeFile(join(f.state.workspace, 'extra'), 'x');
  await assert.rejects(verifySession(f.directory), /E1_FILES_ADDED_OR_REMOVED/); await rm(join(f.state.workspace, 'extra'));
  await writeFile(join(f.state.workspace, 'calculator.test.mjs'), '// no-op');
  await assert.rejects(verifySession(f.directory), /E1_NON_SOURCE_CHANGED/);
});
test('unexpected model code is not executed by the local verifier', async t => {
  const f = await fixture(t); const marker = join(f.parent, 'should-not-exist');
  await writeFile(join(f.state.workspace, 'calculator.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)},'oops'); export const add=(a,b)=>a+b;`);
  await assert.rejects(verifySession(f.directory), /E1_SOURCE_NOT_EXPECTED/);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
});
test('profile execution escalation blocks verification', async t => {
  const f = await fixture(t); await fix(f); const profile = JSON.parse(await readFile(f.state.config, 'utf8'));
  profile.features.shell = true; await writeFile(f.state.config, JSON.stringify(profile));
  await assert.rejects(verifySession(f.directory), /Expected the editable smoke profile/);
});
test('symlink source replacement cannot pass', async t => {
  const f = await fixture(t); const other = join(f.parent, 'source');
  await writeFile(other, DEMO_FILES['calculator.mjs'].replace('return a - b', 'return a + b'));
  await rm(join(f.state.workspace, 'calculator.mjs')); await symlink(other, join(f.state.workspace, 'calculator.mjs'));
  await assert.rejects(verifySession(f.directory), /E1_FILE_TYPE_OR_SIZE/);
});
test('child environment excludes inherited tokens, root override and test-runner context', () => {
  const env = sessionEnvironment({home:'/sample/home',config:'/sample/profile.json'}, {
    PATH:'/bin',LOCALMCP_TOKEN:'private',LOCALMCP_ROOT:'/outside',NODE_OPTIONS:'--inspect',NODE_TEST_CONTEXT:'child-v8',LOCALMCP_SHELL:'1',AWS_SECRET_ACCESS_KEY:'private',
  });
  assert.equal(env.LOCALMCP_SHELL, '0'); assert.equal(env.HOME, '/sample/home');
  for (const key of ['LOCALMCP_TOKEN','LOCALMCP_ROOT','NODE_OPTIONS','NODE_TEST_CONTEXT','AWS_SECRET_ACCESS_KEY']) assert.equal(env[key],undefined);
});
test('start requires deliberate relay opt-in before any session access', () => {
  const r = spawnSync(process.execPath, ['scripts/e1-session.mjs','start'], {cwd:process.cwd(),encoding:'utf8',timeout:5000});
  assert.equal(r.status,1); assert.match(r.stderr,/E1_START_REQUIRES_PUBLIC_RELAY_OPT_IN/);
});
