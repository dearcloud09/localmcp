import { lstat, opendir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export class SensitivePathError extends Error {
  constructor(readonly code: string = 'SENSITIVE_PATH') {
    super(`${code}: File-tool access is blocked by the local path policy.`);
    this.name = 'SensitivePathError';
  }
}
const protectedNames = new Set([
  '.git', '.localmcp', '.ssh', '.aws', '.azure', '.gnupg', '.kube', '.docker',
  '.npmrc', '.pypirc', '.netrc', '_netrc', '.git-credentials', 'localmcp.json',
]);

/** A conservative filename policy, NOT a content secret scanner or an OS sandbox. */
export function isSensitivePath(path: string): boolean {
  if (typeof path !== 'string' || /[\0:]/u.test(path)) return true;
  return path.split(/[\\/]/u).some(raw => {
    const name = raw.normalize('NFKC').toLowerCase().replace(/[. ]+$/u, '');
    return protectedNames.has(name) || name === '.env' || name.startsWith('.env.')
      || /^id_(rsa|dsa|ecdsa|ed25519)(?:[._-]|$)/u.test(name)
      || /\.(key|pem|p12|pfx|jks|keystore)$/u.test(name);
  });
}
export function assertFileToolPath(path: string): void {
  if (isSensitivePath(path)) throw new SensitivePathError();
}

/**
 * A directory rename/delete must not smuggle a protected descendant through a
 * harmless parent name. Preflight is bounded and completes before any mutation.
 * Concurrent hostile filesystem changes are outside this application-level guard.
 */
export async function assertMutableTree(
  root: string, target: string, options: { maxEntries?: number; maxDepth?: number } = {},
): Promise<void> {
  const maxEntries = options.maxEntries ?? 10000;
  const maxDepth = options.maxDepth ?? 64;
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new SensitivePathError('INVALID_SCAN_LIMIT');
  }
  const stack = [{ path: target, depth: 0 }];
  let seen = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++seen > maxEntries || item.depth > maxDepth) throw new SensitivePathError('TREE_SCAN_LIMIT');
    assertFileToolPath(relative(root, item.path));
    const info = await lstat(item.path);
    if (info.isSymbolicLink()) throw new SensitivePathError('SYMLINK_BLOCKED');
    if (info.isFile()) {
      if (info.nlink !== 1) throw new SensitivePathError('HARDLINK_BLOCKED');
      continue;
    }
    if (!info.isDirectory()) throw new SensitivePathError('SPECIAL_FILE_BLOCKED');
    const directory = await opendir(item.path);
    for await (const entry of directory) {
      if (seen + stack.length + 1 > maxEntries) throw new SensitivePathError('TREE_SCAN_LIMIT');
      stack.push({ path: join(item.path, entry.name), depth: item.depth + 1 });
    }
  }
}
