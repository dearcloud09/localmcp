import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeProfile, initializeProfile, inspectProfile, createDemo } from '../scripts/lib/project-profile.mjs';

async function fixture(t) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'permission-profile-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const home = join(base, 'home'), workspace = join(base, 'project');
  await mkdir(home); await mkdir(workspace);
  return { home, workspace, config: join(base, 'profile.json') };
}
test('editable smoke profile explicitly opts in without enabling execution', () => {
  const value = safeProfile('/example/project');
  assert.deepEqual(value.permissions, { fileRead: true, fileWrite: true });
  assert.equal(value.features.shell, false); assert.equal(value.features.processes, false);
  assert.deepEqual(value.mcpServers, {}); assert.deepEqual(value.skills.enabled, []);
});
test('created profile and doctor agree on effective file-write permission', async t => {
  const f = await fixture(t); await initializeProfile(f);
  const document = JSON.parse(await readFile(f.config, 'utf8'));
  const report = await inspectProfile({ ...f, env: {} });
  assert.equal(document.permissions.fileWrite, true); assert.equal(report.capabilities.fileWrites, true);
});
test('legacy or altered profiles are not reported as writable or automatically rewritten', async t => {
  const f = await fixture(t); await initializeProfile(f);
  for (const permissions of [undefined, {}, { fileRead: true, fileWrite: false }, { fileRead: false, fileWrite: true }, { fileRead: true, fileWrite: 'true' }]) {
    const value = safeProfile(f.workspace); value.permissions = permissions;
    await writeFile(f.config, JSON.stringify(value)); const before = await readFile(f.config);
    await assert.rejects(inspectProfile({ ...f, env: {} }), e => e.code === 'NOT_SMOKE_PROFILE');
    assert.deepEqual(await readFile(f.config), before);
  }
});
test('demo also receives explicit write permission and no server starts', async t => {
  const f = await fixture(t); const result = await createDemo({ ...f, parent: f.workspace });
  assert.equal(result.serversStarted, false);
  assert.equal(JSON.parse(await readFile(f.config, 'utf8')).permissions.fileWrite, true);
  assert.equal((await inspectProfile({ ...f, env: {} })).workspace, result.workspace);
});
