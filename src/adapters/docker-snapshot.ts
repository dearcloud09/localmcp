import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, opendir, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { isSensitivePath } from '../core/sensitive-paths.js';
import { runCli, type CliResult } from './cli.js';

export interface SandboxCheck { image: string; executable: string; args: string[]; timeoutMs?: number }
export class SandboxError extends Error {
  constructor(readonly code: string, readonly containerName?: string) { super(`${code}: Isolated check did not complete; no host-execution fallback.${containerName ? ` Cleanup outcome unknown for ${containerName}; do not retry automatically.` : ''}`); this.name = 'SandboxError'; }
}
const requireCondition: (ok: unknown, code: string) => asserts ok = (ok, code) => { if (!ok) throw new SandboxError(code); };
const inside = (child: string, parent: string) => { const p = relative(parent, child); return p === '' || (p !== '..' && !p.startsWith(`..${sep}`) && !isAbsolute(p)); };
export function validateSandboxCheck(value: unknown): SandboxCheck {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_CHECK');
  const c = value as Record<string, unknown>;
  requireCondition(Object.keys(c).every(k => ['image', 'executable', 'args', 'timeoutMs'].includes(k)), 'INVALID_CHECK');
  requireCondition(typeof c.image === 'string' && /^sha256:[a-f0-9]{64}$/.test(c.image), 'PINNED_LOCAL_IMAGE_REQUIRED');
  requireCondition(typeof c.executable === 'string' && /^\/[A-Za-z0-9_./-]+$/.test(c.executable) && !c.executable.split('/').includes('..'), 'INVALID_EXECUTABLE');
  requireCondition(Array.isArray(c.args) && c.args.length > 0 && c.args.length <= 64 && c.args.every(a => typeof a === 'string' && a.length <= 16000 && !a.includes('\0')), 'INVALID_ARGV');
  const timeoutMs = c.timeoutMs ?? 30000;
  requireCondition(Number.isSafeInteger(timeoutMs) && (timeoutMs as number) >= 100 && (timeoutMs as number) <= 120000, 'INVALID_TIMEOUT');
  return { image: c.image, executable: c.executable, args: [...c.args] as string[], timeoutMs: timeoutMs as number };
}
export interface Snapshot { path: string; files: number; bytes: number; excluded: number; sha256: string }
/** Copy regular, single-link files only; never mount the original tree or write results back. */
export async function createSnapshot(rootInput: string, limits: { maxEntries?: number; maxBytes?: number; maxDepth?: number } = {}): Promise<Snapshot> {
  const maxEntries = limits.maxEntries ?? 10000, maxBytes = limits.maxBytes ?? 64 * 1024 * 1024, maxDepth = limits.maxDepth ?? 64;
  requireCondition([maxEntries, maxBytes, maxDepth].every(n => Number.isSafeInteger(n) && n > 0), 'INVALID_SNAPSHOT_LIMIT');
  const root = await realpath(rootInput), home = await realpath(homedir());
  requireCondition((await lstat(root)).isDirectory() && root !== parse(root).root && !inside(home, root), 'WORKSPACE_TOO_BROAD');
  requireCondition(!isSensitivePath(root), 'PROTECTED_SNAPSHOT_ROOT');
  const stage = await mkdtemp(join(await realpath(tmpdir()), 'localmcp-snapshot-'));
  let files = 0, bytes = 0, seen = 0, excluded = 0;
  const manifest: Array<{ path: string; hash: string; mode: number }> = [];
  try {
    requireCondition(!inside(stage, root) && !inside(root, stage) && !/[,\r\n]/u.test(stage), 'UNSAFE_SNAPSHOT_LOCATION');
    const visit = async (source: string, target: string, depth: number): Promise<void> => {
      requireCondition(depth <= maxDepth, 'SNAPSHOT_LIMIT');
      const entries = await opendir(source);
      for await (const entry of entries) {
        requireCondition(++seen <= maxEntries, 'SNAPSHOT_LIMIT');
        const src = join(source, entry.name), dst = join(target, entry.name), rel = relative(root, src);
        if (isSensitivePath(rel)) { excluded++; continue; }
        const metadata = await lstat(src);
        requireCondition(!metadata.isSymbolicLink(), 'SNAPSHOT_LINK');
        if (metadata.isDirectory()) {
          await mkdir(dst, { mode: 0o700 }); await visit(src, dst, depth + 1); continue;
        }
        requireCondition(metadata.isFile() && metadata.nlink === 1, 'SNAPSHOT_FILE_TYPE');
        const file = await open(src, constants.O_RDONLY | constants.O_NOFOLLOW);
        let data: Buffer, mode: number;
        try {
          const before = await file.stat();
          requireCondition(before.isFile() && before.nlink === 1 && before.size <= maxBytes - bytes, 'SNAPSHOT_LIMIT');
          data = await file.readFile();
          const after = await file.stat();
          requireCondition(after.size === before.size && after.mtimeMs === before.mtimeMs && data.length <= maxBytes - bytes, 'SNAPSHOT_CHANGED');
          mode = 0o600 | (before.mode & 0o100);
        } finally { await file.close(); }
        await writeFile(dst, data, { flag: 'wx', mode }); bytes += data.length; files++;
        manifest.push({ path: rel.split(sep).join('/'), hash: createHash('sha256').update(data).digest('hex'), mode });
      }
    };
    await visit(root, stage, 0);
    manifest.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return { path: stage, files, bytes, excluded, sha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex') };
  } catch (error) { await rm(stage, { recursive: true, force: true }); throw error; }
}
export const SANDBOX_BOOTSTRAP = '/bin/cp -R /input/. /workspace/project && cd /workspace/project && exec "$@"';
export function dockerCreateArgs(checkInput: SandboxCheck, snapshot: string, name: string, uid: number, gid: number): string[] {
  const c = validateSandboxCheck(checkInput);
  requireCondition(isAbsolute(snapshot) && !/[,\r\n\0]/u.test(snapshot), 'INVALID_SNAPSHOT_PATH');
  requireCondition(/^localmcp-check-[a-f0-9-]{36}$/.test(name), 'INVALID_CONTAINER_NAME');
  requireCondition(Number.isSafeInteger(uid) && uid > 0 && Number.isSafeInteger(gid) && gid >= 0, 'NONROOT_USER_REQUIRED');
  return ['create', '--pull', 'never', '--name', name, '--label', `localmcp.check=${name}`, '--init',
    '--network', 'none', '--ipc', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1',
    '--no-healthcheck', '--user', `${uid}:${gid}`, '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m,mode=1777',
    '--tmpfs', '/workspace:rw,nosuid,nodev,size=128m,mode=1777',
    '--mount', `type=bind,src=${snapshot},dst=/input,readonly`, '--workdir', '/workspace',
    '--env', 'HOME=/tmp', '--env', 'TMPDIR=/tmp', '--env', 'CI=1', '--entrypoint', '/bin/sh', c.image, '-c', SANDBOX_BOOTSTRAP, 'localmcp-check', c.executable, ...c.args];
}
export function assertDockerInspection(value: unknown, check: SandboxCheck, snapshot: string, name: string, user: string): void {
  const d = value as any;
  requireCondition(d?.Config && d?.HostConfig && Array.isArray(d.Mounts), 'INVALID_CONTAINER_INSPECTION');
  const h = d.HostConfig, c = d.Config;
  requireCondition(d.Image === check.image && c.User === user && c.Labels?.['localmcp.check'] === name, 'CONTAINER_IDENTITY_MISMATCH');
  requireCondition(h.NetworkMode === 'none' && h.IpcMode === 'none' && h.ReadonlyRootfs === true && h.Privileged === false && h.Init === true, 'CONTAINER_POLICY_MISMATCH');
  requireCondition(h.CapDrop?.includes('ALL') && h.SecurityOpt?.some((v: string) => v === 'no-new-privileges' || v === 'no-new-privileges=true'), 'CONTAINER_POLICY_MISMATCH');
  requireCondition(h.Memory === 512 * 1024 * 1024 && h.MemorySwap === h.Memory && h.PidsLimit === 128 && h.NanoCpus === 1e9, 'CONTAINER_RESOURCE_MISMATCH');
  requireCondition(!h.PublishAllPorts && !Object.keys(h.PortBindings ?? {}).length && !(h.Devices?.length) && !h.PidMode && !h.VolumesFrom?.length, 'CONTAINER_POLICY_MISMATCH');
  const binds = d.Mounts.filter((m: any) => m.Type === 'bind');
  requireCondition(binds.length === 1 && binds[0].Source === snapshot && binds[0].Destination === '/input' && binds[0].RW === false, 'CONTAINER_MOUNT_MISMATCH');
  requireCondition(d.Mounts.every((m: any) => m.Type === 'bind' || (m.Type === 'tmpfs' && ['/tmp', '/workspace'].includes(m.Destination))), 'CONTAINER_MOUNT_MISMATCH');
  requireCondition(Object.keys(h.Tmpfs ?? {}).length === 2 && typeof h.Tmpfs['/tmp'] === 'string' && h.Tmpfs['/tmp'].includes('size=64m') && typeof h.Tmpfs['/workspace'] === 'string' && h.Tmpfs['/workspace'].includes('size=128m'), 'CONTAINER_MOUNT_MISMATCH');
  requireCondition(JSON.stringify(c.Entrypoint) === JSON.stringify(['/bin/sh']) && JSON.stringify(c.Cmd) === JSON.stringify(['-c', SANDBOX_BOOTSTRAP, 'localmcp-check', check.executable, ...check.args]), 'CONTAINER_COMMAND_MISMATCH');
}
const successful = (r: CliResult) => r.exitCode === 0 && !r.timedOut && !r.truncated;
const jsonOne = (r: CliResult): any => { requireCondition(successful(r), 'DOCKER_INSPECTION_FAILED'); const a = JSON.parse(r.stdout); requireCondition(Array.isArray(a) && a.length === 1, 'DOCKER_INSPECTION_FAILED'); return a[0]; };

/** Uses only a local Docker context and an already installed immutable image. No pull or host fallback. */
export async function runSandboxCheck(root: string, checkInput: SandboxCheck) {
  const check = validateSandboxCheck(checkInput);
  requireCondition(process.platform === 'linux' || process.platform === 'darwin', 'UNSUPPORTED_SANDBOX_HOST');
  const uid = process.getuid?.() ?? 0, gid = process.getgid?.() ?? 0;
  requireCondition(uid > 0, 'NONROOT_USER_REQUIRED');
  const raw = (args: string[], timeoutMs = 10000) => runCli({ executable: 'docker', args, cwd: root, timeoutMs, maxOutputBytes: 256 * 1024 });
  // Pin the inspected context. DOCKER_HOST/DOCKER_CONTEXT are not inherited by the CLI adapter.
  const context = jsonOne(await raw(['context', 'inspect']));
  requireCondition(typeof context.Name === 'string' && /^[A-Za-z0-9_.-]+$/.test(context.Name) && /^unix:\/\//.test(context.Endpoints?.docker?.Host ?? ''), 'LOCAL_DOCKER_REQUIRED');
  const docker = (args: string[], timeoutMs = 10000) => raw(['--context', context.Name, ...args], timeoutMs);
  const image = jsonOne(await docker(['image', 'inspect', check.image]));
  requireCondition(image.Id === check.image && image.Os === 'linux' && !Object.keys(image.Config?.Volumes ?? {}).length, 'UNSUPPORTED_IMAGE');
  const snapshot = await createSnapshot(root);
  const name = `localmcp-check-${randomUUID()}`;
  let created = false, result: CliResult | undefined, containerExit: number | null = null;
  try {
    // After a create request even a lost response requires explicit cleanup.
    created = true;
    requireCondition(successful(await docker(dockerCreateArgs(check, snapshot.path, name, uid, gid))), 'CONTAINER_CREATE_FAILED');
    assertDockerInspection(jsonOne(await docker(['container', 'inspect', name])), check, snapshot.path, name, `${uid}:${gid}`);
    result = await docker(['start', '--attach', name], check.timeoutMs);
    if (!result.timedOut && !result.truncated) {
      const state = jsonOne(await docker(['container', 'inspect', name])).State;
      requireCondition(state?.Running === false && Number.isInteger(state.ExitCode), 'CONTAINER_OUTCOME_UNKNOWN');
      containerExit = state.ExitCode;
      requireCondition(result.exitCode === containerExit, 'CONTAINER_OUTCOME_UNKNOWN');
    }
  } finally {
    // A killed Docker client is NOT evidence that its container stopped.
    if (created) {
      const cleanup = await docker(['rm', '--force', '--volumes', name]).catch(() => undefined);
      if (!cleanup || !successful(cleanup)) throw new SandboxError('CLEANUP_UNCONFIRMED', name);
    }
    await rm(snapshot.path, { recursive: true, force: true });
  }
  requireCondition(result, 'CONTAINER_OUTCOME_UNKNOWN');
  return { ...result, exitCode: containerExit, backend: 'docker-snapshot', snapshotFiles: snapshot.files,
    snapshotBytes: snapshot.bytes, excludedEntries: snapshot.excluded, snapshotSha256: snapshot.sha256,
    writeback: false, cleanupConfirmed: true, hostFallback: false };
}
