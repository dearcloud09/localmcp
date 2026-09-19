/** Real config/entrypoint checks. Requires upstream dependencies and a fresh build. */
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { config } from '../src/config.js';

const run = promisify(execFile);
async function fixture(t: TestContext) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-config-policy ')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const project = join(base, 'project'); const home = join(base, 'home');
  await mkdir(project); await mkdir(home);
  const profile = join(base, 'profile.json');
  await writeFile(profile, JSON.stringify({ root: project }), { mode: 0o600 });
  const keys = ['LOCALMCP_CONFIG', 'LOCALMCP_ROOT', 'LOCALMCP_SHELL', 'LOCALMCP_PORT'] as const;
  const previous = keys.map(key => [key, process.env[key]] as const);
  for (const key of keys) delete process.env[key];
  process.env.LOCALMCP_CONFIG = profile;
  t.after(() => { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  return { base, project, home, profile };
}
test('actual config loader has files-only execution defaults', async t => {
  const f = await fixture(t); const result = await config();
  assert.equal(result.root, f.project); assert.equal(result.files, true);
  assert.equal(result.shell, false); assert.equal(result.processes, false); assert.deepEqual(result.enabledSkills, []);
});
test('actual config loader rejects a missing explicit file, even with LOCALMCP_ROOT', async t => {
  const f = await fixture(t); process.env.LOCALMCP_CONFIG = join(f.base, 'missing'); process.env.LOCALMCP_ROOT = f.project;
  await assert.rejects(config(), /CONFIG_REQUIRED/);
});
test('actual config loader rejects redirecting and shell-enabling environment overrides', async t => {
  const f = await fixture(t); process.env.LOCALMCP_ROOT = f.home;
  await assert.rejects(config(), /ROOT_OVERRIDE/); delete process.env.LOCALMCP_ROOT;
  process.env.LOCALMCP_SHELL = '1'; await assert.rejects(config(), /SHELL_ESCALATION/);
});
test('actual reload loader rejects an unsafe candidate while the old snapshot remains usable', async t => {
  const f = await fixture(t); const before = await config();
  await assert.rejects(config({ path: f.profile, content: JSON.stringify({ root: f.base }) }), /CONFIG_IN_WORKSPACE/);
  const after = await config(); assert.deepEqual(after, before);
});
test('explicit execution opt-in remains available and can be disabled', async t => {
  const f = await fixture(t); await writeFile(f.profile, JSON.stringify({ root: f.project, features: { shell: true, processes: true } }));
  assert.equal((await config()).processes, true);
  process.env.LOCALMCP_SHELL = '0'; assert.equal((await config()).processes, false);
});
test('actual loader rejects configuration stored inside a workspace', async t => {
  const f = await fixture(t); const inside = join(f.project, 'config.json');
  await writeFile(inside, JSON.stringify({ root: f.project }), { mode: 0o600 });
  process.env.LOCALMCP_CONFIG = inside; await assert.rejects(config(), /CONFIG_IN_WORKSPACE/);
});
test('all executable entrypoints reject invalid config before registration or state creation', { timeout: 30000 }, async t => {
  const f = await fixture(t); let requests = 0;
  // A loopback trap avoids public network activity even if an entrypoint regresses.
  const trap = createServer((_req, res) => { requests++; res.writeHead(500); res.end(); });
  await new Promise<void>(done => trap.listen(0, '127.0.0.1', done));
  t.after(() => new Promise<void>((done, reject) => trap.close(e => e ? reject(e) : done())));
  const address = trap.address(); assert.ok(address && typeof address !== 'string');
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    HOME: f.home, USERPROFILE: f.home,
    LOCALMCP_CONFIG: join(f.base, 'missing'),
    LOCALMCP_WORKER_URL: `http://127.0.0.1:${address.port}`,
  };
  for (const args of [
    ['dist/index.js', 'init'], ['dist/index.js', 'start'], ['dist/index.js', 'agent'],
    ['dist/index.js', 'stdio'], ['dist/index.js', 'http'], ['dist/agent.js'], ['dist/launch.js'],
  ]) {
    await assert.rejects(run(process.execPath, [resolve(args[0]), ...args.slice(1)], { cwd: f.project, env, timeout: 3000, maxBuffer: 65536 }),
      error => (error as { code?: unknown }).code === 1 && /CONFIG_REQUIRED/.test((error as { stderr?: string }).stderr ?? ''));
  }
  assert.equal(requests, 0);
  await assert.rejects(access(join(f.home, '.localmcp')));
  await assert.rejects(access(join(f.project, '.localmcp')));
});
