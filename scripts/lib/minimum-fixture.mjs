import { mkdtemp, mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export const RED_SOURCE = 'export function add(a, b) { return a - b; }\n';
export const GREEN_SOURCE = 'export function add(a, b) { return a + b; }\n';
export const TEST_SOURCE = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from './calculator.mjs';\ntest('positive',()=>assert.equal(add(2,3),5));\ntest('negative',()=>assert.equal(add(-2,-3),-5));\ntest('zero',()=>assert.equal(add(0,4),4));\n";
export const digest = data => createHash('sha256').update(data).digest('hex');
export async function makeFixture() {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-minimum ')));
  const project = join(base, 'project'), home = join(base, 'home'), config = join(base, 'profile.json');
  await mkdir(project); await mkdir(home);
  await writeFile(join(project, 'calculator.mjs'), RED_SOURCE);
  await writeFile(join(project, 'calculator.test.mjs'), TEST_SOURCE);
  await writeFile(join(project, '.env'), 'FAKE_SECRET=NOT_A_REAL_CREDENTIAL\n', { mode: 0o600 });
  return { base, project, home, config };
}
export async function setProfile(f, fileWrite, checks = {}) {
  const value = { root: f.project, permissions: { fileRead: true, fileWrite },
    features: { files: true, shell: false, processes: false }, skills: { dir: 'skills', enabled: [] }, mcpServers: {}, checks };
  await writeFile(f.config, JSON.stringify(value), { mode: 0o600 }); return value;
}
export async function assertSourceOnlyChange(f) {
  assert.equal(await readFile(join(f.project, 'calculator.mjs'), 'utf8'), GREEN_SOURCE);
  assert.equal(await readFile(join(f.project, 'calculator.test.mjs'), 'utf8'), TEST_SOURCE);
  assert.equal(await readFile(join(f.project, '.env'), 'utf8'), 'FAKE_SECRET=NOT_A_REAL_CREDENTIAL\n');
}
