import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRuntimeDocument, resolveRuntimeWorkspaces, resolveExecutionFlags, RuntimePolicyError } from '../src/core/runtime-policy.js';

async function fixture(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-policy ')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const home = join(base, 'home'); const project = join(base, 'project');
  await mkdir(home); await mkdir(project);
  const config = join(base, 'profile.json');
  await writeFile(config, JSON.stringify({ workspaces: { project }, defaultWorkspace: 'project' }), { mode: 0o600 });
  return { base, home, project, config, options: { home, env: {} } };
}
const code = (expected: string) => (error: unknown) => error instanceof RuntimePolicyError && error.code === expected;

test('configuration must exist; missing files do not grant home access', async t => {
  const f = await fixture(t);
  await assert.rejects(readRuntimeDocument(join(f.base, 'missing')), code('CONFIG_REQUIRED'));
});
test('JSON errors never include the invalid document', async t => {
  const f = await fixture(t); await writeFile(f.config, '{TOP-SECRET');
  await assert.rejects(readRuntimeDocument(f.config), e => code('CONFIG_JSON')(e) && !String(e).includes('TOP-SECRET'));
});
test('configuration symlinks and hardlinks are rejected', async t => {
  const f = await fixture(t); const alias = join(f.base, 'alias'); await symlink(f.config, alias);
  await assert.rejects(readRuntimeDocument(alias), code('CONFIG_TYPE'));
  await rm(alias); await link(f.config, alias);
  await assert.rejects(readRuntimeDocument(alias), code('CONFIG_TYPE'));
});
test('configuration directories are rejected before opening', async t => {
  const f = await fixture(t); await assert.rejects(readRuntimeDocument(f.project), code('CONFIG_TYPE'));
});
test('oversized files and reload snapshots are rejected', async t => {
  const f = await fixture(t);
  await assert.rejects(readRuntimeDocument(f.config, ' '.repeat(65537)), code('CONFIG_TOO_LARGE'));
  await writeFile(f.config, ' '.repeat(65537));
  await assert.rejects(readRuntimeDocument(f.config), code('CONFIG_SIZE_OR_TYPE'));
});
test('group writable configuration is rejected on POSIX', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t); await chmod(f.config, 0o660);
  await assert.rejects(readRuntimeDocument(f.config), code('CONFIG_WRITABLE_BY_OTHERS'));
});
test('a regular external document and a valid reload snapshot can be read', async t => {
  const f = await fixture(t);
  assert.deepEqual(await readRuntimeDocument(f.config), JSON.parse(await readFile(f.config, 'utf8')));
  assert.deepEqual(await readRuntimeDocument(f.config, '{"reloaded":true}'), { reloaded: true });
});
test('workspace declaration is explicit, including with an environment root', async t => {
  const f = await fixture(t);
  for (const d of [{}, { workspaces: {} }]) {
    await assert.rejects(resolveRuntimeWorkspaces(d, f.config, { home: f.home, env: { LOCALMCP_ROOT: f.project } }), code('WORKSPACE_REQUIRED'));
  }
});
test('home, its ancestor and the filesystem root are rejected', async t => {
  const f = await fixture(t);
  for (const root of [f.home, f.base, '/']) await assert.rejects(resolveRuntimeWorkspaces({ root }, f.config, f.options), code('WORKSPACE_TOO_BROAD'));
});
test('home aliases cannot bypass the broad-workspace check', async t => {
  const f = await fixture(t); const alias = join(f.base, 'home-alias'); await symlink(f.home, alias, 'dir');
  await assert.rejects(resolveRuntimeWorkspaces({ root: alias }, f.config, f.options), code('WORKSPACE_TOO_BROAD'));
});
test('credential directories and their nested workspaces are rejected', async t => {
  const f = await fixture(t); const secret = join(f.home, '.ssh'); await mkdir(secret); await mkdir(join(secret, 'nested'));
  for (const root of [secret, join(secret, 'nested')]) await assert.rejects(resolveRuntimeWorkspaces({ root }, f.config, f.options), code('PROTECTED_WORKSPACE'));
});
test('credential directory aliases outside home are still protected', async t => {
  const f = await fixture(t); const external = join(f.base, 'credentials'); await mkdir(external); await symlink(external, join(f.home, '.ssh'), 'dir');
  await assert.rejects(resolveRuntimeWorkspaces({ root: external }, f.config, f.options), code('PROTECTED_WORKSPACE'));
});
test('dangling protected-directory symlinks fail closed', async t => {
  const f = await fixture(t); await symlink(join(f.base, 'not-there'), join(f.home, '.ssh'), 'dir');
  await assert.rejects(resolveRuntimeWorkspaces({ root: f.project }, f.config, f.options), code('DANGLING_LINK'));
});
test('configuration cannot be inside any declared workspace', async t => {
  const f = await fixture(t); const inProject = join(f.project, 'settings.json'); await writeFile(inProject, '{}');
  await assert.rejects(resolveRuntimeWorkspaces({ root: f.project }, inProject, f.options), code('CONFIG_IN_WORKSPACE'));
});
test('configuration parent symlinks do not hide workspace overlap', async t => {
  const f = await fixture(t); const inProject = join(f.project, 'settings.json'); await writeFile(inProject, '{}');
  const alias = join(f.base, 'project-alias'); await symlink(f.project, alias, 'dir');
  await assert.rejects(resolveRuntimeWorkspaces({ root: f.project }, join(alias, 'settings.json'), f.options), code('CONFIG_IN_WORKSPACE'));
});
test('valid multi-project roots resolve relative to the configuration file', async t => {
  const f = await fixture(t); const another = join(f.base, 'another'); await mkdir(another);
  const r = await resolveRuntimeWorkspaces({ workspaces: { first: './project', second: another }, defaultWorkspace: 'second' }, f.config, f.options);
  assert.equal(r.root, another); assert.equal(r.workspaces.first, f.project);
});
test('unknown and inherited default workspace names cannot be selected', async t => {
  const f = await fixture(t);
  for (const name of ['missing', 'toString', 'constructor']) await assert.rejects(resolveRuntimeWorkspaces({ root: f.project, defaultWorkspace: name }, f.config, f.options), code('UNKNOWN_WORKSPACE'));
});
test('root and workspaces cannot ambiguously select different projects', async t => {
  const f = await fixture(t); await assert.rejects(resolveRuntimeWorkspaces({ root: f.project, workspaces: { p: f.project } }, f.config, f.options), code('AMBIGUOUS_WORKSPACE'));
});
test('missing, nondirectory and empty workspace paths fail explicitly', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveRuntimeWorkspaces({ root: join(f.base, 'missing') }, f.config, f.options), code('WORKSPACE_MISSING'));
  await assert.rejects(resolveRuntimeWorkspaces({ root: f.config }, f.config, f.options), code('WORKSPACE_NOT_DIRECTORY'));
  await assert.rejects(resolveRuntimeWorkspaces({ root: '' }, f.config, f.options), code('INVALID_PATH'));
});
test('empty and NUL-containing workspace names are rejected', async t => {
  const f = await fixture(t);
  for (const name of ['', 'bad\0name']) await assert.rejects(resolveRuntimeWorkspaces({ workspaces: { [name]: f.project } }, f.config, f.options), code('INVALID_WORKSPACE_NAME'));
});
test('LOCALMCP_ROOT may repeat the exact canonical root but cannot redirect it', async t => {
  const f = await fixture(t); const other = join(f.base, 'other'); await mkdir(other);
  const same = await resolveRuntimeWorkspaces({ root: f.project }, f.config, { home: f.home, env: { LOCALMCP_ROOT: f.project } });
  assert.equal(same.root, f.project);
  await assert.rejects(resolveRuntimeWorkspaces({ root: f.project }, f.config, { home: f.home, env: { LOCALMCP_ROOT: other } }), code('ROOT_OVERRIDE'));
});
test('execution is opt-in, and the environment cannot escalate it', () => {
  assert.deepEqual(resolveExecutionFlags({}, {}), { shell: false, processes: false });
  assert.throws(() => resolveExecutionFlags({}, { LOCALMCP_SHELL: '1' }), code('SHELL_ESCALATION'));
  assert.throws(() => resolveExecutionFlags({ shell: true }, { LOCALMCP_SHELL: 'yes' }), code('SHELL_OVERRIDE'));
});
test('explicit execution remains available, and environment disabling also disables processes', () => {
  assert.deepEqual(resolveExecutionFlags({ shell: true, processes: true }, {}), { shell: true, processes: true });
  assert.deepEqual(resolveExecutionFlags({ shell: true, processes: true }, { LOCALMCP_SHELL: '0' }), { shell: false, processes: false });
  assert.deepEqual(resolveExecutionFlags({ shell: false, processes: true }, {}), { shell: false, processes: false });
});
test('reload candidates are validated before replacing a last-known-good snapshot', async t => {
  const f = await fixture(t); const initial = { root: f.project };
  let current = await resolveRuntimeWorkspaces(initial, f.config, f.options);
  await assert.rejects((async () => { const candidate = await resolveRuntimeWorkspaces({ root: f.home }, f.config, f.options); current = candidate; })(), code('WORKSPACE_TOO_BROAD'));
  assert.equal(current.root, f.project);
});
