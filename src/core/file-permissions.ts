/** File-tool authority only. Shells and external MCP servers have separate authority. */
export interface FilePermissions { fileRead: boolean; fileWrite: boolean }
export const FILE_READ_REQUIREMENTS = ['files', 'fileRead'] as const;
export const FILE_WRITE_REQUIREMENTS = ['files', 'fileRead', 'fileWrite'] as const;

export class FilePermissionError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'FilePermissionError';
  }
}

/** Missing policy means read-only; malformed policy is never silently repaired. */
export function resolveFilePermissions(raw: unknown, filesEnabled: boolean): FilePermissions {
  if (typeof filesEnabled !== 'boolean') throw new FilePermissionError('FILE_PERMISSIONS_INVALID', 'The files feature must be a boolean.');
  const input = raw === undefined ? {} : raw;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new FilePermissionError('FILE_PERMISSIONS_INVALID', 'permissions must be an object.');
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'fileRead' && key !== 'fileWrite')) {
    throw new FilePermissionError('FILE_PERMISSIONS_INVALID', 'Unknown file permission.');
  }
  for (const key of ['fileRead', 'fileWrite']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      throw new FilePermissionError('FILE_PERMISSIONS_INVALID', 'File permissions must be booleans.');
    }
  }
  const read = Object.hasOwn(value, 'fileRead') ? value.fileRead ?? true : true;
  const write = Object.hasOwn(value, 'fileWrite') ? value.fileWrite ?? false : false;
  if (write && !read) {
    throw new FilePermissionError('FILE_WRITE_REQUIRES_READ', 'Write-only mode is unsupported; edits and patches read existing content.');
  }
  return { fileRead: filesEnabled && read === true, fileWrite: filesEnabled && write === true };
}
