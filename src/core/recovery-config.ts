import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { mutationPath } from './mutation-coordinator.js';

export type RecoveryConfig = Readonly<{ mode: 'memory' } | {
  mode: 'durable'; directory: string; capacity: number; lockWaitMs: number;
}>;
export interface RecoveryHostConfig {
  recovery?: RecoveryConfig;
  workspaces: Record<string, string>;
  defaultWorkspace: string;
  configFile?: string;
}
export class RecoveryConfigError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'RecoveryConfigError'; }
}
const fail = (code: string): never => { throw new RecoveryConfigError(code); };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const inside = (child: string, parent: string): boolean => {
  const r = relative(mutationPath(parent), mutationPath(child));
  return r === '' || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r));
};
function absolute(value: unknown): string {
  if (typeof value !== 'string' || !isAbsolute(value) || /[\0\r\n]/u.test(value) || value.length > 4096) fail('RECOVERY_INVALID_PATH');
  return resolve(value as string);
}

/** Synchronous shape check. No coercion, path expansion, directory creation or fallback. */
export function parseRecoveryConfig(value: unknown): RecoveryConfig {
  if (value === undefined) return Object.freeze({ mode: 'memory' });
  if (!object(value)) fail('RECOVERY_INVALID_CONFIG');
  const config = value as Record<string, unknown>;
  if (config.mode === 'memory' && Object.keys(config).length === 1) return Object.freeze({ mode: 'memory' });
  if (config.mode !== 'durable' || Object.keys(config).some(k => !['mode', 'directory', 'capacity', 'lockWaitMs'].includes(k))) fail('RECOVERY_INVALID_CONFIG');
  const capacity = config.capacity === undefined ? 1024 : config.capacity;
  const lockWaitMs = config.lockWaitMs === undefined ? 2000 : config.lockWaitMs;
  if (!Number.isSafeInteger(capacity) || Number(capacity) < 1 || Number(capacity) > 10000 ||
      !Number.isSafeInteger(lockWaitMs) || Number(lockWaitMs) < 1 || Number(lockWaitMs) > 30000) fail('RECOVERY_INVALID_LIMIT');
  return Object.freeze({ mode: 'durable', directory: absolute(config.directory), capacity: Number(capacity), lockWaitMs: Number(lockWaitMs) });
}

/** Validate all scopes before opening a journal. This never writes anything. */
export async function resolveRecoveryConfig(value: unknown, workspaces: Record<string, string>, configFile?: string): Promise<RecoveryConfig> {
  const config = parseRecoveryConfig(value);
  if (config.mode === 'memory') return config;
  if (!['linux', 'darwin'].includes(process.platform) || !process.getuid) fail('RECOVERY_PLATFORM_UNSUPPORTED');
  if (!object(workspaces) || Object.keys(workspaces).length === 0) fail('RECOVERY_WORKSPACES_REQUIRED');
  const parent = await realpath(dirname(config.directory));
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.uid !== process.getuid!() || (parentInfo.mode & 0o077) !== 0) fail('RECOVERY_PARENT_NOT_PRIVATE');
  const directory = join(parent, basename(config.directory));
  for (const path of Object.values(workspaces)) {
    const root = await realpath(absolute(path));
    if (!(await lstat(root)).isDirectory()) fail('RECOVERY_INVALID_WORKSPACE');
    if (inside(directory, root) || inside(root, directory)) fail('RECOVERY_WORKSPACE_OVERLAP');
  }
  if (configFile === undefined) fail('RECOVERY_CONFIG_FILE_REQUIRED');
  const settings = await realpath(absolute(configFile));
  if (inside(settings, directory)) fail('RECOVERY_CONFIG_OVERLAP');
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid!() || (info.mode & 0o077) !== 0) fail('RECOVERY_UNSAFE_DIRECTORY');
  } catch (e) {
    if (!object(e) || e.code !== 'ENOENT') throw e;
    // Missing is allowed for explicit provisioning, NOT for runtime startup.
  }
  return Object.freeze({ ...config, directory });
}

/** Uses normalized config from config(); aliases have already been canonicalized. */
export function recoveryIdentity(config: RecoveryHostConfig): string {
  const mode = parseRecoveryConfig(config.recovery);
  if (mode.mode === 'memory') return 'memory';
  const roots = [...new Set(Object.values(config.workspaces).map(root => mutationPath(absolute(root))))].sort();
  if (!roots.length) fail('RECOVERY_WORKSPACES_REQUIRED');
  return JSON.stringify([mode.mode, mutationPath(mode.directory), mode.capacity, mode.lockWaitMs, roots]);
}
