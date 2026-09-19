import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, restrictedEnvironment } from '../src/adapters/cli.js';
import { readGitStatus, parseGitStatus } from '../src/adapters/git.js';

async function temp(t: TestContext) { const dir = await mkdtemp(join(tmpdir(), 'localmcp cli ')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
async function git(cwd: string, ...args: string[]) {
  const result = await runCli({ executable: 'git', args: ['-c', 'user.name=Local test', '-c', 'user.email=local-test@example.invalid', ...args], cwd });
  assert.equal(result.exitCode, 0, result.stderr); return result;
}
async function repo(t: TestContext) { const root = await temp(t); await git(root, 'init', '-q'); return root; }

test('CLI passes metacharacters as literal argv, without shell expansion', async t => {
  const cwd = await temp(t); const value = 'hello; $(echo WRONG) && /tmp/not-an-action';
  const r = await runCli({ executable: process.execPath, args: ['-e', 'process.stdout.write(process.argv[1])', value], cwd });
  assert.equal(r.stdout, value); assert.equal(r.exitCode, 0); assert.equal(r.timedOut, false);
});
test('CLI returns separate stdout/stderr and nonzero exit status', async t => {
  const cwd = await temp(t);
  const r = await runCli({ executable: process.execPath, args: ['-e', "process.stdout.write('out');process.stderr.write('err');process.exitCode=7"], cwd });
  assert.equal(r.stdout, 'out'); assert.equal(r.stderr, 'err'); assert.equal(r.exitCode, 7);
});
test('CLI supports cwd with spaces', async t => {
  const cwd = await temp(t); const r = await runCli({ executable: process.execPath, args: ['-e', 'process.stdout.write(process.cwd())'], cwd });
  assert.equal(r.exitCode, 0, r.stderr);
  assert.equal(await realpath(r.stdout), await realpath(cwd));
});
test('default child environment omits server tokens and arbitrary inherited variables', () => {
  assert.deepEqual(restrictedEnvironment({ PATH: '/bin', HOME: '/home/test', LOCALMCP_TOKEN: 'secret', NODE_OPTIONS: '--inspect' }), { PATH: '/bin', HOME: '/home/test' });
});
test('CLI records timeouts instead of reporting success', async t => {
  const cwd = await temp(t); const r = await runCli({ executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd, timeoutMs: 100 });
  assert.equal(r.timedOut, true); assert.notEqual(r.signal, null);
});
test('CLI caps output without manufacturing a partial UTF-8 suffix', async t => {
  const cwd = await temp(t); const r = await runCli({ executable: process.execPath, args: ['-e', "process.stdout.write('가'.repeat(10000))"], cwd, maxOutputBytes: 101 });
  assert.equal(r.truncated, true); assert.ok(Buffer.byteLength(r.stdout) <= 101); assert.doesNotMatch(r.stdout, /\ufffd/);
});
test('CLI missing executable and invalid cwd reject with actual launch errors', async t => {
  const cwd = await temp(t);
  await assert.rejects(runCli({ executable: join(cwd, 'missing-command'), args: [], cwd }), /ENOENT/);
  await assert.rejects(runCli({ executable: process.execPath, args: [], cwd: join(cwd, 'missing-directory') }), /ENOENT/);
});
test('CLI rejects invalid limits and NUL arguments before execution', async t => {
  const cwd = await temp(t);
  await assert.rejects(runCli({ executable: process.execPath, args: [], cwd, timeoutMs: 0 }));
  await assert.rejects(runCli({ executable: process.execPath, args: ['bad\0value'], cwd }));
});

test('Git parser preserves spaces, newlines, Unicode and rename source ordering', () => {
  const rows = parseGitStatus(' M src/a b.ts\0R  새 이름.ts\0old\nname.ts\0?? fresh.txt\0');
  assert.deepEqual(rows, [
    { index: ' ', worktree: 'M', path: 'src/a b.ts' },
    { index: 'R', worktree: ' ', path: '새 이름.ts', originalPath: 'old\nname.ts' },
    { index: '?', worktree: '?', path: 'fresh.txt' },
  ]);
});
test('Git parser rejects incomplete output rather than reporting clean', () => {
  assert.throws(() => parseGitStatus(' M file'), /Incomplete/);
  assert.throws(() => parseGitStatus('R  new\0'), /Missing rename/);
  assert.throws(() => parseGitStatus('x\0'), /Malformed/);
});
test('Git adapter reads an actual empty repository as clean', async t => {
  const root = await repo(t); const result = await readGitStatus(root);
  assert.equal(result.clean, true); assert.equal(result.totalEntries, 0); assert.equal(result.exitCode, 0);
});
test('Git adapter returns bounded real changes without modifying the index', async t => {
  const root = await repo(t); await writeFile(join(root, 'tracked.txt'), 'first'); await git(root, 'add', '--', 'tracked.txt'); await git(root, 'commit', '-qm', 'baseline');
  await writeFile(join(root, 'tracked.txt'), 'changed'); await writeFile(join(root, 'new file.txt'), 'new');
  const result = await readGitStatus(root, 1);
  assert.equal(result.clean, false); assert.equal(result.truncated, true); assert.equal(result.entries.length, 1); assert.equal(result.totalEntries, 2);
  const staged = await git(root, 'diff', '--cached', '--name-only'); assert.equal(staged.stdout, '');
});
test('Git adapter handles staged renames with Unicode filenames', async t => {
  const root = await repo(t); await writeFile(join(root, 'old.txt'), 'content'); await git(root, 'add', '--', 'old.txt'); await git(root, 'commit', '-qm', 'baseline');
  await rename(join(root, 'old.txt'), join(root, '새 이름.txt')); await git(root, 'add', '-A');
  const result = await readGitStatus(root); assert.equal(result.entries[0].path, '새 이름.txt'); assert.equal(result.entries[0].originalPath, 'old.txt');
});
test('Git adapter refuses implicit parent-repository traversal', async t => {
  const root = await repo(t); const child = join(root, 'child'); await mkdir(child);
  await assert.rejects(readGitStatus(child), /working-tree root/);
});
test('Git failures do not masquerade as an empty status', async t => {
  const root = await temp(t); await assert.rejects(readGitStatus(root), /failed/);
});
