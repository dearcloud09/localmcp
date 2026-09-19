import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';

export interface CliRequest {
  executable: string;
  args: readonly string[];
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  /** Trusted adapter-supplied settings only; not a model-facing arbitrary environment. */
  env?: Readonly<Record<string, string>>;
}
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}
export function restrictedEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'HOME', 'USER', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'SHELL', 'SystemRoot', 'USERPROFILE']) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  return env;
}

/** Execute argv literally. This is not an allowlist or an OS sandbox. */
export async function runCli(request: CliRequest): Promise<CliResult> {
  const { executable, args, cwd } = request;
  const timeoutMs = request.timeoutMs ?? 30000;
  const maxBytes = request.maxOutputBytes ?? 256 * 1024;
  if (!executable || executable.includes('\0') || !cwd || cwd.includes('\0')) throw new Error('Invalid executable or cwd');
  if (args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw new Error('Invalid CLI argument');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('Invalid CLI timeout');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 4 || maxBytes > 4 * 1024 * 1024) throw new Error('Invalid output limit');
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable)) {
    throw new Error('Windows batch scripts require an explicit adapter; implicit shell fallback is disabled');
  }
  return new Promise<CliResult>((resolve, reject) => {
    const start = performance.now();
    const child = spawn(executable, [...args], {
      cwd, shell: false, detached: process.platform !== 'win32', windowsHide: true,
      env: { ...restrictedEnvironment(), ...request.env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    const output = { stdout: '', stderr: '' };
    let captured = 0, timedOut = false, truncated = false, done = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const terminate = (force = false) => {
      if (!child.pid) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
        else if (process.env.SystemRoot) {
          const killer = spawn(join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
          killer.on('error', () => { try { child.kill(); } catch {} });
        } else child.kill();
      } catch { /* The process may have exited just before the signal. */ }
      if (!force && !forceTimer) forceTimer = setTimeout(() => terminate(true), 250);
    };
    const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
    const collect = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
      const remaining = Math.max(0, maxBytes - captured);
      const accepted = chunk.subarray(0, remaining);
      captured += accepted.length;
      output[stream] += decoders[stream].write(accepted);
      if (chunk.length > accepted.length && !truncated) { truncated = true; terminate(); }
    };
    child.stdout.on('data', chunk => collect('stdout', chunk));
    child.stderr.on('data', chunk => collect('stderr', chunk));
    const cleanup = () => { clearTimeout(timer); if (forceTimer) clearTimeout(forceTimer); };
    child.once('error', error => {
      if (done) return;
      done = true; cleanup(); reject(error);
    });
    child.once('close', (exitCode, signal) => {
      if (done) return;
      done = true;
      // Complete process-tree cleanup before canceling an outstanding escalation timer.
      if (timedOut || truncated) terminate(true);
      cleanup();
      // If output was capped, discard an incomplete suffix rather than replacing a cut character.
      if (!truncated) {
        output.stdout += decoders.stdout.end();
        output.stderr += decoders.stderr.end();
      }
      resolve({ ...output, exitCode, signal, timedOut, truncated, durationMs: Math.max(0, performance.now() - start) });
    });
  });
}
