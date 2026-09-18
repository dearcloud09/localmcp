import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, readdir, rm, symlink, link, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace } from '../src/workspace.js';
import { assertFileToolPath, assertMutableTree, isSensitivePath, SensitivePathError } from '../src/core/sensitive-paths.js';

async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'localmcp sensitive ')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, ws: new Workspace(root) };
}
const blocked = (promise: Promise<unknown>, code = 'SENSITIVE_PATH') => assert.rejects(promise,
  error => error instanceof SensitivePathError && error.code === code);

test('protected names apply at every depth and include config, credential and key files', () => {
  for (const path of ['.env', '.env.local', '.env.example', 'a/.git/config', 'a/.ssh/id_rsa',
    '.aws/credentials', '.docker/config.json', '.localmcp/worker.json', 'localmcp.json',
    '.npmrc', '.pypirc', '.netrc', '.git-credentials', 'keys/client.pem', 'client.pfx']) {
    assert.equal(isSensitivePath(path), true, path);
    assert.throws(() => assertFileToolPath(path), SensitivePathError);
  }
});
test('case, alternate separators, compatibility characters and Windows aliases fail closed', () => {
  for (const path of ['.ENV', 'config\\.aws\\credentials', '.git. /config', '.ＥＮＶ', 'file:stream', 'x\0y']) {
    assert.equal(isSensitivePath(path), true, path);
  }
});
test('ordinary source names are not blocked by credential substrings', () => {
  for (const path of ['', '.', 'src/environment.ts', 'src/key.ts', 'src/secret-handler.ts', '.gitignore', '.gitkeep', 'docs/keys.md']) {
    assert.equal(isSensitivePath(path), false, path);
  }
});
test('direct reads, ranged reads and metadata cannot expose a protected file', async t => {
  const { root, ws } = await fixture(t); await writeFile(join(root, '.env'), 'FAKE_SECRET_SENTINEL');
  await blocked(ws.read('.env')); await blocked(ws.readLines('.env')); await blocked(ws.stat('.env'));
});
test('creation of a protected nested path is rejected before any parent is made', async t => {
  const { root, ws } = await fixture(t);
  await blocked(ws.write('fresh/.env/value', 'bad', false));
  assert.deepEqual(await readdir(root), []);
});
test('write, patch and delete leave an existing protected file unchanged', async t => {
  const { root, ws } = await fixture(t); const file = join(root, '.env'); await writeFile(file, 'keep');
  await blocked(ws.write('.env', 'bad', true));
  await blocked(ws.applyEdits('.env', [{ startLine: 1, endLine: 1, replacement: 'bad' }]));
  await blocked(ws.delete('.env', false)); assert.equal(await readFile(file, 'utf8'), 'keep');
});
test('list pagination counts only visible entries and search/tree never return protected names or content', async t => {
  const { root, ws } = await fixture(t);
  await mkdir(join(root, 'src')); await mkdir(join(root, '.aws'));
  await writeFile(join(root, '.env'), 'FAKE_SECRET_SENTINEL');
  await writeFile(join(root, '.aws', 'credentials'), 'FAKE_SECRET_SENTINEL');
  await writeFile(join(root, 'src', 'a.ts'), 'public needle');
  const list = await ws.list('.', 0, 1); assert.equal(list.total, 1); assert.equal(list.nextOffset, null);
  const outputs = [list, await ws.tree(), await ws.findFiles('.', '*', 50), await ws.search('.', 'FAKE_SECRET_SENTINEL', false, false, 20, 0)];
  assert.doesNotMatch(JSON.stringify(outputs), /FAKE_SECRET_SENTINEL|\.env|credentials|\.aws/);
  assert.equal((await ws.search('.', 'public needle', false, false, 20, 0)).matches.length, 1);
});
test('direct search and directory listing of protected trees are rejected', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, '.git'));
  await blocked(ws.list('.git', 0, 5)); await blocked(ws.tree('.git'));
  await blocked(ws.findFiles('.git', '*', 5)); await blocked(ws.search('.git', 'x', false, false, 5, 0));
});
test('renaming a secret to an ordinary name and the reverse are both blocked', async t => {
  const { root, ws } = await fixture(t); await writeFile(join(root, '.env'), 'keep');
  await ws.write('ok.txt', 'public', false);
  await blocked(ws.move('.env', 'exposed.txt', false)); await blocked(ws.move('ok.txt', '.env', true));
  assert.equal(await ws.read('ok.txt'), 'public'); assert.equal(await readFile(join(root, '.env'), 'utf8'), 'keep');
});
test('parent-directory rename cannot move protected descendants', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, 'bundle'));
  await writeFile(join(root, 'bundle', '.env'), 'keep');
  await blocked(ws.move('bundle', 'new/renamed', false));
  assert.equal(await readFile(join(root, 'bundle', '.env'), 'utf8'), 'keep');
  assert.deepEqual(await readdir(root), ['bundle']);
});
test('recursive parent delete is preflighted, not partially applied before rejection', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, 'bundle'));
  await writeFile(join(root, 'bundle', 'a.txt'), 'keep ordinary'); await writeFile(join(root, 'bundle', '.env'), 'keep secret');
  await blocked(ws.delete('bundle', true));
  assert.equal(await readFile(join(root, 'bundle', 'a.txt'), 'utf8'), 'keep ordinary');
});
test('a destination directory with protected descendants cannot be overwritten', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, 'from')); await mkdir(join(root, 'to'));
  await writeFile(join(root, 'to', '.env'), 'keep');
  await blocked(ws.move('from', 'to', true)); assert.equal(await readFile(join(root, 'to', '.env'), 'utf8'), 'keep');
});
test('directory mutation preflight does not skip ignored dependency directories', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, 'bundle', 'node_modules'), { recursive: true });
  await writeFile(join(root, 'bundle', 'node_modules', '.env'), 'keep');
  await blocked(ws.delete('bundle', true));
});
test('symlink aliases cannot expose secrets and are omitted from ordinary lists', async t => {
  const { root, ws } = await fixture(t); await writeFile(join(root, '.env'), 'FAKE');
  await symlink(join(root, '.env'), join(root, 'alias'));
  await assert.rejects(ws.read('alias'), /Symbolic/);
  assert.deepEqual((await ws.list('.', 0, 10)).entries, []);
});
test('hardlink aliases cannot expose or rewrite secret bytes', async t => {
  const { root, ws } = await fixture(t); await writeFile(join(root, '.env'), 'FAKE');
  await link(join(root, '.env'), join(root, 'alias.txt'));
  await blocked(ws.read('alias.txt'), 'HARDLINK_BLOCKED');
  await blocked(ws.delete('alias.txt', false), 'HARDLINK_BLOCKED');
  await blocked(ws.move('alias.txt', 'other.txt', false), 'HARDLINK_BLOCKED');
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'FAKE');
});
test('parent mutation containing an otherwise ordinary symlink is denied', async t => {
  const { root, ws } = await fixture(t); await mkdir(join(root, 'bundle')); await ws.write('ok', 'keep', false);
  await symlink(join(root, 'ok'), join(root, 'bundle', 'alias'));
  await blocked(ws.delete('bundle', true), 'SYMLINK_BLOCKED');
  assert.equal(await ws.read('ok'), 'keep');
});
test('bounded preflight refuses oversized trees and depth without side effects', async t => {
  const { root } = await fixture(t); await mkdir(join(root, 'a', 'b'), { recursive: true });
  await blocked(assertMutableTree(root, join(root, 'a'), { maxEntries: 1 }), 'TREE_SCAN_LIMIT');
  await blocked(assertMutableTree(root, join(root, 'a'), { maxDepth: 0 }), 'TREE_SCAN_LIMIT');
  await blocked(assertMutableTree(root, join(root, 'a'), { maxEntries: 0 }), 'INVALID_SCAN_LIMIT');
  assert.deepEqual(await readdir(join(root, 'a')), ['b']);
});
test('ordinary directory move, overwrite, patch and recursive removal still work', async t => {
  const { root, ws } = await fixture(t); await ws.write('src/a.ts', 'one\ntwo', false);
  await ws.applyEdits('src/a.ts', [{ startLine: 2, endLine: 2, replacement: 'TWO' }]);
  await ws.move('src', 'renamed', false); assert.equal(await ws.read('renamed/a.ts'), 'one\nTWO');
  await ws.delete('renamed', true); await ws.createDirectory('empty'); await ws.delete('empty', false);
  assert.deepEqual(await readdir(root), []);
});
test('workspace-root movement and removal are refused', async t => {
  const { ws } = await fixture(t); await assert.rejects(ws.move('.', '../new', false), /workspace root/);
  await assert.rejects(ws.delete('.', true), /workspace root/);
});
test('path denial errors do not echo user paths or secret text', () => {
  assert.throws(() => assertFileToolPath('private-customer/.env'), error => {
    assert.ok(error instanceof SensitivePathError); assert.doesNotMatch(error.message, /private-customer|\.env/); return true;
  });
});
