import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Utf8TailBuffer } from './core/utf8-buffer.js';

interface ManagedProcess {
  id: string;
  child: ChildProcess;
  command: string;
  cwd: string;
  stdout: Utf8TailBuffer;
  stderr: Utf8TailBuffer;
  startedAt: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  closed: boolean;
  error?: string;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();

  start(command: string, cwd: string) {
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SHELL', 'SystemRoot']) if (process.env[key]) env[key] = process.env[key];
    const child = spawn(command, { cwd, shell: true, detached: process.platform !== 'win32', env, stdio: ['pipe', 'pipe', 'pipe'] });
    const proc: ManagedProcess = {
      id: randomUUID(), child, command, cwd,
      stdout: new Utf8TailBuffer(), stderr: new Utf8TailBuffer(),
      startedAt: new Date().toISOString(), exitCode: null, signal: null, closed: false,
    };
    child.stdout?.on('data', (chunk: Buffer) => proc.stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => proc.stderr.push(chunk));
    child.stdin?.on('error', error => { proc.error = error.message; });
    // An asynchronous spawn error must not become an unhandled event that kills the bridge.
    child.on('error', error => { proc.error = error.message; proc.closed = true; });
    child.on('close', (code, signal) => {
      proc.exitCode = code; proc.signal = signal; proc.closed = true;
      proc.stdout.end(); proc.stderr.end();
    });
    this.processes.set(proc.id, proc);
    return { processId: proc.id, pid: child.pid, running: true, startedAt: proc.startedAt };
  }

  read(id: string, stdoutCursor = 0, stderrCursor = 0) {
    const proc = this.mustGet(id);
    const out = proc.stdout.read(stdoutCursor);
    const err = proc.stderr.read(stderrCursor);
    return {
      processId: id, stdout: out.text, stderr: err.text,
      nextStdoutCursor: out.nextCursor, nextStderrCursor: err.nextCursor,
      stdoutTruncated: out.truncatedBeforeCursor, stderrTruncated: err.truncatedBeforeCursor,
      running: !proc.closed, exitCode: proc.exitCode, signal: proc.signal,
      ...(proc.error ? { error: proc.error } : {}),
    };
  }

  write(id: string, input: string) {
    const proc = this.mustGet(id);
    if (proc.closed || !proc.child.stdin || proc.child.stdin.destroyed) throw new Error('Process stdin is not available');
    // Capture EPIPE from a concurrently exiting child instead of emitting an unhandled error.
    proc.child.stdin.write(input, error => { if (error) proc.error = error.message; });
    return { processId: id, bytes: Buffer.byteLength(input) };
  }

  stop(id: string) {
    const proc = this.mustGet(id);
    if (proc.closed) return { processId: id, running: false, exitCode: proc.exitCode, signal: proc.signal };
    try {
      if (process.platform !== 'win32' && proc.child.pid) process.kill(-proc.child.pid, 'SIGTERM');
      else proc.child.kill('SIGTERM');
    } catch { /* Stop is a request; callers inspect read_process for the final state. */ }
    return { processId: id, stopping: true };
  }

  list() {
    return [...this.processes.values()].map(proc => ({
      processId: proc.id, pid: proc.child.pid, command: proc.command, cwd: proc.cwd,
      startedAt: proc.startedAt, running: !proc.closed, exitCode: proc.exitCode, signal: proc.signal,
    }));
  }

  async close() {
    for (const proc of this.processes.values()) {
      if (!proc.closed) {
        try {
          if (process.platform !== 'win32' && proc.child.pid) process.kill(-proc.child.pid, 'SIGKILL');
          else proc.child.kill('SIGKILL');
        } catch { /* Already exited. */ }
      }
    }
  }

  private mustGet(id: string) {
    const proc = this.processes.get(id);
    if (!proc) throw new Error('Unknown processId');
    return proc;
  }
}
