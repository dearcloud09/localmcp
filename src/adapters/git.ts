import { realpath } from 'node:fs/promises';
import { runCli, type CliResult } from './cli.js';

export interface GitStatusEntry {
  index: string;
  worktree: string;
  path: string;
  originalPath?: string;
}

/** Parse Git's NUL-delimited porcelain v1; filenames may contain spaces or newlines. */
export function parseGitStatus(output: string): GitStatusEntry[] {
  if (output && !output.endsWith('\0')) throw new Error('Incomplete Git status output');
  const records = output.split('\0');
  records.pop();
  const entries: GitStatusEntry[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.length < 4 || record[2] !== ' ') throw new Error('Malformed Git status output');
    const entry: GitStatusEntry = { index: record[0], worktree: record[1], path: record.slice(3) };
    if (entry.index === 'R' || entry.index === 'C' || entry.worktree === 'R' || entry.worktree === 'C') {
      const originalPath = records[++i];
      if (!originalPath) throw new Error('Missing rename source in Git status');
      entry.originalPath = originalPath;
    }
    entries.push(entry);
  }
  return entries;
}
function assertComplete(result: CliResult): void {
  if (result.timedOut) throw new Error('Git status timed out; result is incomplete');
  if (result.truncated) throw new Error('Git status output limit reached; result is incomplete');
  if (result.exitCode !== 0 || result.signal) throw new Error(`Git status failed (exit ${result.exitCode ?? 'unknown'})`);
}

/** Read-only intent; requires a trusted repository and a trusted Git executable on PATH. */
export async function readGitStatus(root: string, maxResults = 200) {
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 2000) throw new Error('Invalid maxResults');
  const cwd = await realpath(root);
  const env = { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  const common = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.hooksPath=/dev/null'];
  // Prevent Git from silently walking to a parent repository outside the selected workspace.
  const top = await runCli({ executable: 'git', args: [...common, 'rev-parse', '--show-toplevel'], cwd, env });
  assertComplete(top);
  const topPath = top.stdout.replace(/\r?\n$/, '');
  if (await realpath(topPath) !== cwd) throw new Error('Workspace must be the Git working-tree root');
  const result = await runCli({
    executable: 'git', args: [...common, 'status', '--porcelain=v1', '-z', '--untracked-files=normal', '--ignore-submodules=all'],
    cwd, env, maxOutputBytes: 1024 * 1024,
  });
  assertComplete(result);
  const entries = parseGitStatus(result.stdout);
  return {
    entries: entries.slice(0, maxResults), totalEntries: entries.length,
    truncated: entries.length > maxResults, clean: entries.length === 0,
    exitCode: result.exitCode, durationMs: top.durationMs + result.durationMs,
  };
}
