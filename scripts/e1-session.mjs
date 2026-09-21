#!/usr/bin/env node
// E1 preparation and local evidence; never claims which actor edited a file.
import assert from 'node:assert/strict';
import { access, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createDemo, DEMO_FILES, inspectProfile, within } from './lib/project-profile.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRelay = 'https://localmcp-relay.daodao973597.workers.dev';
const names = [...Object.keys(DEMO_FILES), 'E1_CHALLENGE.txt'].sort();
const greenSource = DEMO_FILES['calculator.mjs'].replace('return a - b', 'return a + b');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const defaultDirectory = () => join(homedir(), '.localmcp-e1');

export function sessionEnvironment(session, source = process.env) {
  const env = {};
  for (const key of ['PATH', 'SystemRoot', 'LANG', 'LC_ALL']) if (source[key] !== undefined) env[key] = source[key];
  return { ...env, HOME: session.home, USERPROFILE: session.home,
    XDG_CONFIG_HOME: join(session.home, '.config'), XDG_CACHE_HOME: join(session.home, '.cache'),
    LOCALMCP_CONFIG: session.config, LOCALMCP_SHELL: '0', LOCALMCP_WORKER_URL: publicRelay,
    WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };
}
async function text(path) {
  const info = await lstat(path);
  assert.ok(info.isFile() && info.nlink === 1 && info.size <= 16384, 'E1_FILE_TYPE_OR_SIZE');
  return readFile(path, 'utf8');
}
function runFixture(session, expectedExit, expectedSummary) {
  const r = spawnSync(process.execPath, ['--test', 'calculator.test.mjs'], {
    cwd: session.workspace, env: sessionEnvironment(session), encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
  });
  assert.equal(r.error, undefined, 'E1_TEST_LAUNCH_FAILED');
  assert.equal(r.signal, null, 'E1_TEST_INTERRUPTED');
  assert.equal(r.status, expectedExit, 'E1_UNEXPECTED_TEST_EXIT');
  assert.match(r.stdout, expectedSummary, 'E1_UNEXPECTED_TEST_SUMMARY');
  return { exitCode: r.status, tests: 3 };
}
export async function prepareSession(directory = defaultDirectory()) {
  // Deliberately create-only. Never reset/reuse a previously exposed session.
  await mkdir(directory, { mode: 0o700 });
  const base = await realpath(directory), home = join(base, 'home'), parent = join(base, 'projects');
  await mkdir(home, { mode: 0o700 }); await mkdir(parent, { mode: 0o700 });
  const config = join(base, 'profile.json');
  const demo = await createDemo({ parent, config, home });
  const session = { schema: 1, home, config, workspace: demo.workspace, baseline: {} };
  await writeFile(join(session.workspace, 'E1_CHALLENGE.txt'), randomUUID() + '\n', { flag: 'wx', mode: 0o600 });
  await inspectProfile({ config, home, env: sessionEnvironment(session) });
  for (const name of names) session.baseline[name] = sha(await text(join(session.workspace, name)));
  runFixture(session, 1, /fail 3\b/);
  await writeFile(join(base, 'session.json'), JSON.stringify(session, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { status: 'E1_PREPARED', baselineFailed: 3, session: base, networkStarted: false };
}
async function loadSession(directory) {
  const base = await realpath(directory);
  const session = JSON.parse(await text(join(base, 'session.json')));
  assert.equal(session.schema, 1, 'E1_SESSION_VERSION');
  assert.equal(session.home, join(base, 'home'), 'E1_HOME_MISMATCH');
  assert.equal(session.config, join(base, 'profile.json'), 'E1_CONFIG_MISMATCH');
  assert.ok(typeof session.workspace === 'string' && within(session.workspace, join(base, 'projects')),
    'E1_WORKSPACE_MISMATCH');
  assert.equal(await realpath(session.workspace), session.workspace, 'E1_WORKSPACE_ALIAS');
  assert.deepEqual(Object.keys(session.baseline).sort(), names, 'E1_BASELINE_NAMES');
  const profile = await inspectProfile({ config: session.config, home: session.home, env: sessionEnvironment(session) });
  assert.equal(profile.workspace, session.workspace, 'E1_PROFILE_MISMATCH');
  return { base, session };
}
async function assertFiles(session, expectedSource) {
  assert.deepEqual((await readdir(session.workspace)).sort(), names, 'E1_FILES_ADDED_OR_REMOVED');
  for (const name of names) {
    const value = await text(join(session.workspace, name));
    if (name === 'calculator.mjs') assert.equal(value, expectedSource, 'E1_SOURCE_NOT_EXPECTED; no generated code executed');
    else assert.equal(sha(value), session.baseline[name], 'E1_NON_SOURCE_CHANGED');
  }
}
export async function verifySession(directory = defaultDirectory()) {
  const { base, session } = await loadSession(directory);
  // Only the exact known one-operator edit is executed on the host. Fail closed otherwise.
  await assertFiles(session, greenSource);
  runFixture(session, 0, /pass 3\b/);
  await assertFiles(session, greenSource);
  const evidence = { status: 'E1_LOCAL_CHECK_OK', tests: 3, pass: 3, changedFiles: ['calculator.mjs'],
    testFileUnchanged: true, challenge: (await text(join(session.workspace, 'E1_CHALLENGE.txt'))).trim(),
    chatgptActorVerified: false, meaning: 'Compare this challenge with actual ChatGPT MCP calls; local files alone cannot attribute the edit.' };
  await writeFile(join(base, `evidence-${randomUUID()}.json`), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return evidence;
}
async function runAgent(session, stop = false) {
  const script = join(root, 'dist', stop ? 'index.js' : 'agent.js'); await access(script);
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script, ...(stop ? ['stop'] : [])], {
      cwd: root, env: sessionEnvironment(session), stdio: 'inherit', shell: false,
    });
    const interrupt = () => { child.kill('SIGINT'); };
    const terminate = () => { child.kill('SIGTERM'); };
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
    const clear = () => { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); };
    child.once('error', error => { clear(); reject(error); });
    child.once('close', (code, signal) => { clear(); done(code ?? (signal ? 1 : 0)); });
  });
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  assert.ok(['prepare', 'start', 'check', 'stop'].includes(command), 'Use: node scripts/e1-session.mjs prepare|start --public-relay|check|stop');
  assert.ok(command === 'start' ? args.length === 1 && args[0] === '--public-relay' : args.length === 0,
    'E1_START_REQUIRES_PUBLIC_RELAY_OPT_IN');
  if (command === 'prepare') console.log(JSON.stringify(await prepareSession(), null, 2));
  else if (command === 'check') console.log(JSON.stringify(await verifySession(), null, 2));
  else {
    const { session } = await loadSession(defaultDirectory());
    if (command === 'start') {
      await assertFiles(session, DEMO_FILES['calculator.mjs']);
      console.log('E1 uses the third-party public Cloudflare relay. Only the disposable sample is exposed.');
      console.log('MCP URL contains a credential: paste it ONLY into ChatGPT app settings. Ctrl+C stops this session.');
    }
    process.exitCode = await runAgent(session, command === 'stop');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error('E1_BLOCKED:', error.code === 'EEXIST' ? 'Session already exists; no overwrite or reset performed.' : error.message); process.exitCode = 1; });
}
