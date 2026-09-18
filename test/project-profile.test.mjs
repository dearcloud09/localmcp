import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createDemo, initializeProfile, inspectProfile, projectRoot, safeProfile, within } from '../scripts/lib/project-profile.mjs';

async function fixture(t) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp profile ')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const home = join(base, 'home'), workspace = join(home, 'Developer', 'demo with spaces');
  await mkdir(workspace, { recursive: true });
  return { base, home, workspace, config: join(home, '.localmcp', 'profiles', 'smoke.json') };
}
const check = (f, env = {}) => inspectProfile({ config: f.config, home: f.home, env });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const cli = fileURLToPath(new URL('../scripts/project-profile.mjs', import.meta.url));
// Nested node --test must not inherit the outer runner's private IPC context.
const envWithoutOverrides = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !['LOCALMCP_ROOT', 'LOCALMCP_SHELL', 'LOCALMCP_CONFIG', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT'].includes(key)));

// Pure checks, file behavior, CLI behavior and an actual red/green fixture are separate assertions.
test('within uses path segments, not string prefixes', () => {
  assert.equal(within('/tmp/repo2', '/tmp/repo'), false);
  assert.equal(within('/tmp/repo/a', '/tmp/repo'), true);
  assert.equal(within('/tmp/repo', '/tmp/repo'), true);
});
test('profile creation enables only files and no automatic skills', async t => {
  const f = await fixture(t); const result = await initializeProfile(f);
  assert.equal(result.serversStarted, false);
  assert.deepEqual(JSON.parse(await readFile(f.config, 'utf8')), safeProfile(f.workspace));
  assert.equal((await check(f)).status, 'profile-check-passed');
});
test('new profile has owner-only permissions on POSIX', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t); await initializeProfile(f);
  assert.equal((await stat(f.config)).mode & 0o777, 0o600);
});
test('existing configuration is preserved byte-for-byte', async t => {
  const f = await fixture(t); await initializeProfile(f); const before = await readFile(f.config);
  await rejects(initializeProfile(f), 'CONFIG_EXISTS');
  assert.deepEqual(await readFile(f.config), before);
});
test('concurrent initializers have exactly one winner', async t => {
  const f = await fixture(t); const results = await Promise.allSettled([initializeProfile(f), initializeProfile(f)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected')[0].reason.code, 'CONFIG_EXISTS');
  assert.equal((await check(f)).status, 'profile-check-passed');
});
test('home and its ancestors are rejected', async t => {
  const f = await fixture(t);
  for (const workspace of [f.home, f.base, parse(f.base).root]) await rejects(projectRoot(workspace, f), 'WORKSPACE_TOO_BROAD');
});
test('credential directories cannot become workspaces', async t => {
  const f = await fixture(t); const workspace = join(f.home, '.ssh', 'keys'); await mkdir(workspace, { recursive: true });
  await rejects(projectRoot(workspace, f), 'PROTECTED_WORKSPACE');
});
test('explicit path is required instead of falling back to home', async t => {
  const f = await fixture(t);
  for (const workspace of ['', ' ', undefined, '\0']) await rejects(initializeProfile({ ...f, workspace }), 'PATH_REQUIRED');
});
test('missing workspace and regular file are rejected', async t => {
  const f = await fixture(t); await writeFile(join(f.base, 'file'), 'x');
  await rejects(projectRoot(join(f.base, 'missing'), f), 'WORKSPACE_MISSING');
  await rejects(projectRoot(join(f.base, 'file'), f), 'WORKSPACE_NOT_DIRECTORY');
});
test('symlink alias of home cannot bypass broad-root rejection', async t => {
  const f = await fixture(t); const alias = join(f.base, 'alias'); await symlink(f.home, alias, 'junction');
  await rejects(projectRoot(alias, f), 'WORKSPACE_TOO_BROAD');
});
test('valid project alias resolves to its physical root', async t => {
  const f = await fixture(t); const alias = join(f.base, 'alias'); await symlink(f.workspace, alias, 'junction');
  assert.equal(await projectRoot(alias, f), f.workspace);
});
test('config inside workspace is rejected before writing', async t => {
  const f = await fixture(t);
  await rejects(initializeProfile({ ...f, config: join(f.workspace, 'runtime', 'config.json') }), 'CONFIG_IN_WORKSPACE');
  await assert.rejects(stat(join(f.workspace, 'runtime')), { code: 'ENOENT' });
});
test('config parent symlink into workspace is rejected', async t => {
  const f = await fixture(t); const alias = join(f.base, 'alias'); await symlink(f.workspace, alias, 'junction');
  await rejects(initializeProfile({ ...f, config: join(alias, 'new', 'config.json') }), 'CONFIG_IN_WORKSPACE');
});
test('config symlink cannot be overwritten', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t); await mkdir(dirname(f.config), { recursive: true });
  const target = join(f.base, 'keep'); await writeFile(target, 'keep'); await symlink(target, f.config);
  await rejects(initializeProfile(f), 'CONFIG_EXISTS');
  assert.equal(await readFile(target, 'utf8'), 'keep');
});
test('doctor rejects symlink profiles', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t); await initializeProfile(f); const alias = join(f.base, 'alias.json'); await symlink(f.config, alias);
  await rejects(inspectProfile({ ...f, config: alias, env: {} }), 'CONFIG_NOT_REGULAR');
});
test('doctor rejects hardlinked profiles', async t => {
  const f = await fixture(t); await initializeProfile(f); await link(f.config, join(f.base, 'copy.json'));
  await rejects(check(f), 'CONFIG_NOT_REGULAR');
});
test('doctor rejects broad profile file permissions on POSIX', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t); await initializeProfile(f); await chmod(f.config, 0o644);
  await rejects(check(f), 'CONFIG_PERMISSIONS');
});
test('malformed JSON is rejected without echoing secret content', async t => {
  const f = await fixture(t); await initializeProfile(f); await writeFile(f.config, '{"token":"VERY_PRIVATE_SENTINEL",');
  await assert.rejects(check(f), error => error.code === 'CONFIG_JSON' && !error.message.includes('VERY_PRIVATE'));
});
test('oversized configuration is rejected', async t => {
  const f = await fixture(t); await initializeProfile(f); await writeFile(f.config, ' '.repeat(65537));
  await rejects(check(f), 'CONFIG_SIZE_OR_TYPE');
});
test('doctor rejects execution and upstream MCP enablement', async t => {
  const f = await fixture(t); await initializeProfile(f);
  for (const alter of [v => { v.features.shell = true; }, v => { v.features.processes = true; }, v => { v.skills.enabled = ['x']; }, v => { v.mcpServers.a = { command: 'x' }; }]) {
    const value = safeProfile(f.workspace); alter(value); await writeFile(f.config, JSON.stringify(value));
    await rejects(check(f), 'NOT_SMOKE_PROFILE');
  }
});
test('doctor rejects unknown fields and nonobject configurations', async t => {
  const f = await fixture(t); await initializeProfile(f);
  for (const value of [null, [], { ...safeProfile(f.workspace), token: 'not-printed' }, { ...safeProfile(f.workspace), defaultWorkspace: 'other' }]) {
    await writeFile(f.config, JSON.stringify(value)); await rejects(check(f), 'NOT_SMOKE_PROFILE');
  }
});
test('doctor rejects unsafe overrides and allows explicit shell-off', async t => {
  const f = await fixture(t); await initializeProfile(f);
  await rejects(check(f, { LOCALMCP_SHELL: '1' }), 'ENV_OVERRIDE');
  await rejects(check(f, { LOCALMCP_ROOT: f.workspace }), 'ENV_OVERRIDE');
  await rejects(check(f, { LOCALMCP_CONFIG: join(f.base, 'other.json') }), 'CONFIG_OVERRIDE');
  assert.equal((await check(f, { LOCALMCP_CONFIG: f.config, LOCALMCP_SHELL: '0', LOCALMCP_TOKEN: 'PRIVATE' })).status, 'profile-check-passed');
});
test('doctor detects workspace path replaced by home symlink', async t => {
  const f = await fixture(t); await initializeProfile(f); await rm(f.workspace, { recursive: true }); await symlink(f.home, f.workspace, 'junction');
  await rejects(check(f), 'WORKSPACE_TOO_BROAD');
});
test('doctor returns hash and limitations, never unrelated env secrets', async t => {
  const f = await fixture(t); await initializeProfile(f); const result = await check(f, { SOME_SECRET: 'SENTINEL' });
  assert.match(result.sha256, /^[a-f0-9]{64}$/); assert.equal(result.capabilities.fileWrites, true);
  assert.equal(result.limitations.length, 3); assert.ok(!JSON.stringify(result).includes('SENTINEL'));
});
test('demo is create-only, deliberately red, and green after source-only fix', async t => {
  const f = await fixture(t); const parent = dirname(f.workspace); const result = await createDemo({ ...f, parent });
  const run = () => spawnSync(process.execPath, ['--test', 'calculator.test.mjs'], { cwd: result.workspace, encoding: 'utf8', env: envWithoutOverrides(), timeout: 10000 });
  const before = await readFile(join(result.workspace, 'calculator.test.mjs'));
  const red = run(); assert.equal(red.status, 1, red.stderr); assert.match(red.stdout, /fail 3/);
  await writeFile(join(result.workspace, 'calculator.mjs'), 'export function add(a, b) { return a + b; }\n');
  const green = run(); assert.equal(green.status, 0, green.stderr); assert.match(green.stdout, /pass 3/);
  assert.deepEqual(await readFile(join(result.workspace, 'calculator.test.mjs')), before);
  assert.equal((await check(f)).workspace, result.workspace);
});
test('demo refuses an existing config before creating sample files', async t => {
  const f = await fixture(t); await initializeProfile(f);
  await rejects(createDemo({ ...f, parent: dirname(f.workspace) }), 'CONFIG_EXISTS');
});
test('CLI validates arguments without writing configuration', () => {
  for (const args of [[], ['init'], ['doctor', '--config', 'x', '--config', 'y'], ['init', '--bogus', 'x']]) {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: envWithoutOverrides(), timeout: 10000 });
    assert.equal(r.status, 1); assert.equal(JSON.parse(r.stderr).code, 'USAGE');
  }
});
test('CLI init and doctor complete in a real subprocess', async t => {
  const f = await fixture(t); const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: envWithoutOverrides(), timeout: 10000 });
  const init = run(['init', '--workspace', f.workspace, '--config', f.config]); assert.equal(init.status, 0, init.stderr);
  const doctor = run(['doctor', '--config', f.config]); assert.equal(doctor.status, 0, doctor.stderr);
  assert.equal(JSON.parse(doctor.stdout).capabilities.shell, false);
});
