import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

/** Startup/configuration policy, not an OS sandbox or a per-file secret filter. */
export class RuntimePolicyError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'RuntimePolicyError';
  }
}
const fail = (code: string, message: string): never => { throw new RuntimePolicyError(code, message); };
const maxConfigBytes = 64 * 1024;
export function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
function expand(value: string, base: string, home: string): string {
  if (!value.trim() || value.includes('\0')) return fail('INVALID_PATH', 'An explicit nonempty path is required.');
  if (value === '~') return home;
  return value.startsWith('~/') ? resolve(home, value.slice(2)) : resolve(base, value);
}
async function futureRealpath(path: string): Promise<string> {
  const suffix: string[] = [];
  for (let current = path; ;) {
    try { return resolve(await realpath(current), ...suffix); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        if ((await lstat(current)).isSymbolicLink()) fail('DANGLING_LINK', 'A protected path contains a dangling link.');
      } catch (inner) { if ((inner as NodeJS.ErrnoException).code !== 'ENOENT') throw inner; }
      const parent = dirname(current);
      if (parent === current) throw error;
      suffix.unshift(basename(current)); current = parent;
    }
  }
}

/** A missing/unsafe config is an error, never permission to expose home. */
export async function readRuntimeDocument(path: string, snapshot?: string): Promise<unknown> {
  let metadata;
  try { metadata = await lstat(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fail('CONFIG_REQUIRED', 'Create an external project profile first: node scripts/project-profile.mjs init --workspace <project> --config <profile>. Set LOCALMCP_CONFIG to it.');
    }
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    return fail('CONFIG_TYPE', 'The configuration must be a regular file with one hard link.');
  }
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let text: string;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > maxConfigBytes) return fail('CONFIG_SIZE_OR_TYPE', 'Configuration must be a regular file of at most 64 KiB.');
    if (process.platform !== 'win32' && (info.mode & 0o022) !== 0) return fail('CONFIG_WRITABLE_BY_OTHERS', 'Configuration must not be group/world writable.');
    text = snapshot ?? await file.readFile('utf8');
    if (Buffer.byteLength(text) > maxConfigBytes) return fail('CONFIG_TOO_LARGE', 'Configuration exceeds 64 KiB.');
  } finally { await file.close(); }
  try { return JSON.parse(text); }
  catch { return fail('CONFIG_JSON', 'Configuration is not valid JSON; contents were not printed.'); }
}

export interface WorkspaceDeclaration {
  root?: string;
  workspaces?: Record<string, string>;
  defaultWorkspace?: string;
}
export interface BoundaryOptions { home?: string; env?: NodeJS.ProcessEnv; }
export async function resolveRuntimeWorkspaces(
  declaration: WorkspaceDeclaration, configFile: string, options: BoundaryOptions = {},
): Promise<{ root: string; workspaces: Record<string, string>; defaultWorkspace: string }> {
  const home = await realpath(options.home ?? homedir());
  const env = options.env ?? process.env;
  const entries = Object.entries(declaration.workspaces ?? {});
  if (declaration.root !== undefined && entries.length) return fail('AMBIGUOUS_WORKSPACE', 'Use root or workspaces, not both.');
  if (!entries.length && declaration.root !== undefined) entries.push(['default', declaration.root]);
  if (!entries.length) return fail('WORKSPACE_REQUIRED', 'Declare at least one project explicitly; there is no home or cwd fallback.');
  const config = await realpath(configFile);
  const protectedPaths: string[] = [];
  for (const name of ['.localmcp', '.ssh', '.aws', '.gnupg', '.kube']) {
    protectedPaths.push(await futureRealpath(join(home, name)));
  }
  const resolved: Array<[string, string]> = [];
  for (const [name, path] of entries) {
    if (!name.trim() || name.includes('\0')) return fail('INVALID_WORKSPACE_NAME', 'Workspace names must be nonempty.');
    let root: string;
    try { root = await realpath(expand(path, dirname(config), home)); }
    catch (error) {
      if (error instanceof RuntimePolicyError) throw error;
      return fail('WORKSPACE_MISSING', 'Every declared workspace must exist.');
    }
    if (!(await stat(root)).isDirectory()) return fail('WORKSPACE_NOT_DIRECTORY', 'A workspace must be a directory.');
    if (root === parse(root).root || isWithin(home, root)) return fail('WORKSPACE_TOO_BROAD', 'Filesystem root, home, and ancestors of home are not workspaces.');
    if (protectedPaths.some(p => isWithin(root, p) || isWithin(p, root))) return fail('PROTECTED_WORKSPACE', 'A workspace overlaps a runtime or credential directory.');
    if (isWithin(config, root)) return fail('CONFIG_IN_WORKSPACE', 'Keep configuration outside every model-writable workspace.');
    resolved.push([name, root]);
  }
  const workspaces = Object.fromEntries(resolved);
  const defaultWorkspace = declaration.defaultWorkspace ?? resolved[0][0];
  if (!Object.hasOwn(workspaces, defaultWorkspace)) return fail('UNKNOWN_WORKSPACE', 'The default workspace is not declared.');
  const root = workspaces[defaultWorkspace];
  if (env.LOCALMCP_ROOT !== undefined) {
    let override: string;
    try { override = await realpath(expand(env.LOCALMCP_ROOT, dirname(config), home)); }
    catch (error) {
      if (error instanceof RuntimePolicyError) throw error;
      return fail('ROOT_OVERRIDE', 'LOCALMCP_ROOT must resolve to the declared default project.');
    }
    if (override !== root) return fail('ROOT_OVERRIDE', 'LOCALMCP_ROOT cannot switch the project selected by configuration.');
  }
  return { root, workspaces, defaultWorkspace };
}

/** Environment settings may turn execution off, never turn an ungranted capability on. */
export function resolveExecutionFlags(
  features: { shell?: boolean; processes?: boolean }, env: NodeJS.ProcessEnv = process.env,
): { shell: boolean; processes: boolean } {
  const override = env.LOCALMCP_SHELL;
  if (override !== undefined && override !== '0' && override !== '1') return fail('SHELL_OVERRIDE', 'LOCALMCP_SHELL must be 0 or 1.');
  if (override === '1' && features.shell !== true) return fail('SHELL_ESCALATION', 'An environment override cannot grant shell execution.');
  const shell = features.shell === true && override !== '0';
  return { shell, processes: shell && features.processes === true };
}
