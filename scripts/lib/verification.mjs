import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function isolatedEnvironment(home, source = process.env) {
  const env = {};
  for (const key of ['PATH', 'SystemRoot', 'LANG', 'LC_ALL']) if (source[key] !== undefined) env[key] = source[key];
  return { ...env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, '.config'),
    XDG_CACHE_HOME: join(home, '.cache'), CI: '1', NO_COLOR: '1',
    WRANGLER_SEND_METRICS: 'false', npm_config_update_notifier: 'false', npm_config_offline: 'true',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, '.gitconfig') };
}
export async function atomicReport(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(temporary, path);
}
/** Tooling runner only. No shell, automatic retries, or package installation. */
export function runProcess(command, args, { cwd, env, timeoutMs = 180000, maxBytes = 4 * 1024 * 1024, signal } = {}) {
  if (typeof command !== 'string' || !command || command.includes('\0') || !Array.isArray(args) || args.some(a => typeof a !== 'string' || a.includes('\0'))) throw new Error('INVALID_COMMAND');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 4) throw new Error('INVALID_LIMIT');
  if (signal?.aborted) return Promise.resolve({ exitCode: null, signal: null, reason: 'cancelled', stdout: '', stderr: '', durationMs: 0 });
  return new Promise(resolve => {
    let stdout = '', stderr = '', bytes = 0, reason = null, settled = false, hardTimer;
    const started = performance.now(), out = new StringDecoder('utf8'), err = new StringDecoder('utf8');
    const child = spawn(command, args, { cwd, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = (why, hard = false) => {
      reason ??= why;
      try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, hard ? 'SIGKILL' : 'SIGTERM'); else child.kill('SIGKILL'); } catch {}
      if (!hard && !hardTimer) hardTimer = setTimeout(() => stop(why, true), 250);
    };
    const abort = () => stop('cancelled');
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const collect = (which, data) => {
      const part = data.subarray(0, Math.max(0, maxBytes - bytes)); bytes += part.length;
      if (which === 'out') stdout += out.write(part); else stderr += err.write(part);
      if (part.length !== data.length) stop('output_limit');
    };
    child.stdout.on('data', c => collect('out', c)); child.stderr.on('data', c => collect('err', c));
    const finish = (exitCode, terminatingSignal, launchCode) => {
      if (settled) return; settled = true;
      if (reason) stop(reason, true);
      clearTimeout(timer); clearTimeout(hardTimer); signal?.removeEventListener('abort', abort);
      if (reason !== 'output_limit') { stdout += out.end(); stderr += err.end(); }
      resolve({ exitCode, signal: terminatingSignal, reason: reason ?? (launchCode ? 'launch_failed' : exitCode === 0 ? null : 'nonzero_exit'),
        launchCode, stdout, stderr, durationMs: performance.now() - started });
    };
    child.once('error', e => finish(null, null, typeof e.code === 'string' ? e.code : 'UNKNOWN'));
    child.once('close', (code, sig) => finish(code, sig));
  });
}
export async function runStages(stages, { directory, cwd, env, signal, report = {}, onStage = () => {} }) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const ids = stages.map(s => s.id);
  if (ids.some(id => !/^[a-z0-9-]+$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('INVALID_STAGE_ID');
  const state = { ...report, startedAt: new Date().toISOString(), status: 'running', stages: [] };
  const save = () => atomicReport(join(directory, 'report.json'), state);
  await save();
  for (const stage of stages) {
    if (signal?.aborted) { state.status = 'cancelled'; break; }
    const entry = { id: stage.id, status: 'running' }; state.stages.push(entry); await save(); onStage(stage.id);
    const r = await runProcess(stage.command, stage.args, { cwd, env: stage.env ?? env, signal, timeoutMs: stage.timeoutMs });
    await writeFile(join(directory, `${stage.id}.log`), `${r.stdout}\n--- stderr ---\n${r.stderr}`, { mode: 0o600 });
    Object.assign(entry, { status: r.reason ? 'failed' : 'passed', exitCode: r.exitCode, reason: r.reason,
      signal: r.signal, launchCode: r.launchCode, durationMs: r.durationMs });
    if (r.reason) { state.status = r.reason === 'cancelled' ? 'cancelled' : 'failed'; await save(); break; }
    await save();
  }
  if (state.status === 'running') state.status = state.stages.length === stages.length ? 'passed' : 'incomplete';
  state.finishedAt = new Date().toISOString(); await save(); return state;
}
