import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSnapshot, validateSandboxCheck, dockerCreateArgs, assertDockerInspection, type SandboxCheck, SANDBOX_BOOTSTRAP } from '../src/adapters/docker-snapshot.js';

const check: SandboxCheck = { image: `sha256:${'a'.repeat(64)}`, executable: '/usr/local/bin/node', args: ['--test'] };
const name = 'localmcp-check-00000000-0000-4000-8000-000000000000';
async function fixture(t: TestContext) { const root = await mkdtemp(join(tmpdir(), 'snapshot source ')); t.after(() => rm(root, { recursive: true, force: true })); return root; }
async function snapshot(t: TestContext, root: string) { const s = await createSnapshot(root); t.after(() => rm(s.path, { recursive: true, force: true })); return s; }

test('check validation requires an immutable local image, absolute executable and bounded argv', () => {
  assert.deepEqual(validateSandboxCheck(check), { ...check, timeoutMs: 30000 });
  for (const c of [null, { ...check, image: 'node:latest' }, { ...check, image: 'repo@sha256:' + 'a'.repeat(64) },
    { ...check, executable: 'node' }, { ...check, executable: '/usr/../bin/node' }, { ...check, args: [] },
    { ...check, args: ['bad\0arg'] }, { ...check, timeoutMs: 0 }, { ...check, timeoutMs: 120001 }, { ...check, env: { KEY: 'x' } }]) assert.throws(() => validateSandboxCheck(c));
});
test('validation clones configured argv', () => { const c = { ...check, args: ['--test'] }; const valid = validateSandboxCheck(c); c.args[0] = 'changed'; assert.equal(valid.args[0], '--test'); });
test('container plan uses no network, no privileges, no image pull, no original tree mount', () => {
  const args = dockerCreateArgs(check, '/tmp/stage with spaces', name, 1000, 1000);
  for (const [flag, value] of [['--pull', 'never'], ['--network', 'none'], ['--cap-drop', 'ALL'], ['--user', '1000:1000']]) assert.equal(args[args.indexOf(flag) + 1], value);
  for (const flag of ['--read-only', '--no-healthcheck', '--init']) assert.ok(args.includes(flag));
  for (const flag of ['--privileged', '--publish', '--volume', '--env-file', '--use-api-socket']) assert.ok(!args.includes(flag));
  assert.equal(args.filter(x => x === '--mount').length, 1); assert.equal(args[args.indexOf('--mount') + 1], 'type=bind,src=/tmp/stage with spaces,dst=/input,readonly');
});
test('plan rejects mount delimiters, root execution and arbitrary container names', () => {
  for (const path of ['/tmp/x,y', '/tmp/x\ny', 'relative']) assert.throws(() => dockerCreateArgs(check, path, name, 1000, 1000));
  assert.throws(() => dockerCreateArgs(check, '/tmp/stage', 'somebody-elses-container', 1000, 1000));
  assert.throws(() => dockerCreateArgs(check, '/tmp/stage', name, 0, 0));
});
function inspection() { return { Image: check.image, Config: { User: '1000:1000', Labels: { 'localmcp.check': name }, Entrypoint: ['/bin/sh'], Cmd: ['-c', SANDBOX_BOOTSTRAP, 'localmcp-check', check.executable, ...check.args] },
  HostConfig: { Tmpfs: { '/tmp': 'rw,nosuid,nodev,size=64m,mode=1777', '/workspace': 'rw,nosuid,nodev,size=128m,mode=1777' }, NetworkMode: 'none', IpcMode: 'none', ReadonlyRootfs: true, Privileged: false, Init: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], Memory: 536870912, MemorySwap: 536870912, PidsLimit: 128, NanoCpus: 1e9 },
  Mounts: [{ Type: 'bind', Source: '/tmp/stage', Destination: '/input', RW: false }] }; }
test('inspection validation accepts the exact planned contract (unit data, not Docker execution)', () => { assertDockerInspection(inspection(), check, '/tmp/stage', name, '1000:1000'); });
test('inspection rejects missing isolation, mismatched image, extra mounts and resource drift', () => {
  for (const change of [ (v: any) => v.HostConfig.NetworkMode = 'host', (v: any) => v.HostConfig.Privileged = true,
    (v: any) => v.HostConfig.ReadonlyRootfs = false, (v: any) => v.Config.User = '0', (v: any) => v.Mounts.push({ Type: 'bind' }),
    (v: any) => v.Image = 'wrong', (v: any) => v.HostConfig.Memory = 0, (v: any) => v.Config.Cmd = ['other'] ]) {
    const value = inspection(); change(value); assert.throws(() => assertDockerInspection(value, check, '/tmp/stage', name, '1000:1000'));
  }
});
test('snapshot copies Unicode, spaces and executable modes without altering source', async t => {
  const root = await fixture(t); await writeFile(join(root, '한 글.mjs'), 'hello', { mode: 0o700 });
  const s = await snapshot(t, root); assert.equal(await readFile(join(s.path, '한 글.mjs'), 'utf8'), 'hello');
  assert.equal((await stat(join(s.path, '한 글.mjs'))).mode & 0o700, 0o700); assert.equal(s.files, 1);
  await writeFile(join(s.path, '한 글.mjs'), 'changed'); assert.equal(await readFile(join(root, '한 글.mjs'), 'utf8'), 'hello');
});
test('snapshot excludes sensitive names including nested credentials and VCS metadata', async t => {
  const root = await fixture(t); await mkdir(join(root, '.git')); await writeFile(join(root, '.git', 'config'), 'fake');
  await writeFile(join(root, '.env'), 'fake'); await writeFile(join(root, 'normal.mjs'), 'hello');
  const s = await snapshot(t, root); assert.equal(s.files, 1); assert.equal(s.excluded, 2); await assert.rejects(stat(join(s.path, '.env')));
});
test('snapshot hash is deterministic and changes when input bytes change', async t => {
  const root = await fixture(t); await writeFile(join(root, 'a'), 'x');
  const a = await snapshot(t, root), b = await snapshot(t, root); assert.equal(a.sha256, b.sha256);
  await writeFile(join(root, 'a'), 'y'); assert.notEqual((await snapshot(t, root)).sha256, a.sha256);
});
test('snapshot refuses symlink content instead of following host paths', async t => {
  const root = await fixture(t), other = await fixture(t); await writeFile(join(other, 'file'), 'outside');
  await symlink(join(other, 'file'), join(root, 'link')); await assert.rejects(createSnapshot(root), /SNAPSHOT_LINK/);
});
test('snapshot refuses hardlinks', async t => {
  const root = await fixture(t); await writeFile(join(root, 'a'), 'x'); await link(join(root, 'a'), join(root, 'b'));
  await assert.rejects(createSnapshot(root), /SNAPSHOT_FILE_TYPE/);
});
test('snapshot enforces byte, depth and entry ceilings', async t => {
  const root = await fixture(t); await mkdir(join(root, 'a')); await mkdir(join(root, 'a', 'b')); await writeFile(join(root, 'a', 'b', 'file'), 'longdata');
  await assert.rejects(createSnapshot(root, { maxBytes: 2 }), /SNAPSHOT_LIMIT/);
  await assert.rejects(createSnapshot(root, { maxDepth: 1 }), /SNAPSHOT_LIMIT/);
  await assert.rejects(createSnapshot(root, { maxEntries: 1 }), /SNAPSHOT_LIMIT/);
});
test('snapshot cannot recursively copy its own temporary directory', async () => { await assert.rejects(createSnapshot(tmpdir()), /UNSAFE_SNAPSHOT_LOCATION|WORKSPACE_TOO_BROAD/); });

test('snapshot refuses a protected directory as its root', async t => { const base = await fixture(t); const root = join(base, '.ssh'); await mkdir(root); await writeFile(join(root, 'config'), 'private'); await assert.rejects(createSnapshot(root), /PROTECTED_SNAPSHOT_ROOT/); });
