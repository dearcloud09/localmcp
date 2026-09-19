#!/usr/bin/env node
import { access, mkdir, mkdtemp, readFile, realpath } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicReport, isolatedEnvironment, runProcess, runStages } from './lib/verification.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-verification-')));
const home = join(directory, 'home'); await mkdir(home, { mode: 0o700 });
const env = isolatedEnvironment(home);
const controller = new AbortController();
const cancel = () => controller.abort(); process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
try {
  const args = process.argv.slice(2);
  if (!(args.length === 0 || (args.length === 2 && args[0] === '--image' && /^sha256:[a-f0-9]{64}$/.test(args[1])))) throw new Error('Usage: node scripts/verify-minimum.mjs [--image sha256:LOCAL_IMAGE_ID]');
  if (!['darwin', 'linux'].includes(process.platform)) throw new Error('This verification runner currently supports macOS/Linux only.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node 22 or newer is required.');
  for (const path of ['package-lock.json', 'node_modules/typescript/package.json', 'node_modules/tsx/package.json', 'node_modules/@modelcontextprotocol/sdk/package.json']) {
    try { await access(join(root, path)); } catch { throw new Error(`Missing prerequisite: ${path}. Install the pinned dependencies locally before retrying; this runner never installs them automatically.`); }
  }
  const head = await runProcess('git', ['rev-parse', 'HEAD'], { cwd: root, env, timeoutMs: 10000 });
  if (head.reason) throw new Error('Cannot identify repository revision.');
  const worktree = await runProcess('git', ['status', '--porcelain=v1', '-z'], { cwd: root, env, timeoutMs: 10000 });
  if (worktree.reason) throw new Error('Cannot inspect working tree.');
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (typeof pkg.scripts?.check !== 'string' || typeof pkg.scripts?.build !== 'string' || typeof pkg.scripts?.test !== 'string') throw new Error('Expected package scripts are missing.');
  const stages = [
    { id: 'typecheck', command: 'npm', args: ['run', 'check'] },
    { id: 'build', command: 'npm', args: ['run', 'build'] },
    { id: 'full-tests', command: 'npm', args: ['test'], timeoutMs: 300000 },
    { id: 'mcp-smoke', command: process.execPath, args: [join(root, 'scripts/smoke-mcp.mjs')], timeoutMs: 60000 },
  ];
  if (args.length) stages.push({ id: 'docker-smoke', command: process.execPath, args: [join(root, 'scripts/smoke-sandbox.mjs'), args[1]], timeoutMs: 300000, env: { ...env, HOME: homedir(), USERPROFILE: homedir() } });
  const result = await runStages(stages, { directory, cwd: root, env, signal: controller.signal,
    report: { revision: head.stdout.trim(), dirtyWorkingTree: worktree.stdout.length > 0, node: process.version, platform: process.platform,
      dockerRequested: args.length > 0, liveChatGPTTested: false, reportMeaning: 'Local verification only. An unfinished running stage has an unknown outcome; do not replay automatically.' },
    onStage: id => console.log(`Checking: ${id}`) });
  console.log(`Report: ${join(directory, 'report.json')}`);
  if (result.status !== 'passed') { process.exitCode = 1; console.error('MINIMUM_CHECK_FAILED; inspect the first failed stage log.'); }
  else console.log(args.length ? 'MINIMUM_LOCAL_AND_SANDBOX_OK' : 'MINIMUM_LOCAL_OK (Docker and live ChatGPT not tested)');
} catch (error) {
  await atomicReport(join(directory, 'report.json'), { status: 'blocked', message: error instanceof Error ? error.message : 'Unknown error', liveChatGPTTested: false });
  console.error(error instanceof Error ? error.message : 'Verification blocked'); console.error(`Report: ${join(directory, 'report.json')}`); process.exitCode = 1;
} finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
