import { constants, type Stats } from 'node:fs';
import { lstat, mkdir, open, opendir, readdir, realpath, rename, rm, rmdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { mutationPath, type OperationResult, type MutationJournalBackend } from './mutation-coordinator.js';

export class RecoveryError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'RecoveryError'; }
}
export interface EditReceipt {
  path: string; bytes: number; beforeSha256: string; afterSha256: string; edits?: number;
}
export type RecoveryState =
  | { state: 'absent' }
  | { state: 'unresolved'; reason: 'unfinished_or_active' | 'invalid_record' }
  | { state: 'succeeded'; fingerprint: string; receipt: EditReceipt }
  | { state: 'failed'; fingerprint: string };
export interface RecoverySummary {
  state: 'absent' | 'unresolved' | 'succeeded' | 'failed' | 'blocked';
  reason?: 'unfinished_or_active' | 'invalid_record' | 'unsafe_record' | 'unexpected_record_entry';
  automaticRetry: false;
  nextAction: 'no_record_not_proof_of_no_effect' | 'historical_receipt_only' | 'operator_review';
}
export interface JournalInventoryEntry extends RecoverySummary { reference: string }
export interface JournalInventory {
  schema: 1; mode: 'read-only'; scope: 'local-operator'; atomicSnapshot: false;
  allocationLock: 'observed_present' | 'not_observed'; ownerLiveness: 'not_inferred';
  totalObserved: number; capacity: number; capacityRemainingObserved: number;
  records: JournalInventoryEntry[]; nextCursor: string | null;
  automaticRetry: false; changedRecords: false;
}
export function summarizeRecoveryState(state: RecoveryState): RecoverySummary {
  if (state.state === 'absent') return { state: 'absent', automaticRetry: false, nextAction: 'no_record_not_proof_of_no_effect' };
  if (state.state === 'succeeded') return { state: 'succeeded', automaticRetry: false, nextAction: 'historical_receipt_only' };
  if (state.state === 'unresolved') return { state: 'unresolved', reason: state.reason, automaticRetry: false, nextAction: 'operator_review' };
  return { state: 'failed', automaticRetry: false, nextAction: 'operator_review' };
}
export interface JournalOptions { directory: string; workspaceRoots: readonly string[]; capacity?: number; lockWaitMs?: number; openMode?: 'create-or-open' | 'existing-only' | 'create-only' }
const MAX_RECORD_BYTES = 16384;
const SHA = /^[a-f0-9]{64}$/;
const OP = /^[A-Za-z0-9_-]{8,128}$/;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = (v: string): string => createHash('sha256').update(v).digest('hex');
const inside = (child: string, parent: string): boolean => {
  const r = relative(parent, child); return r === '' || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r));
};
const errorCode = (e: unknown): unknown => object(e) ? e.code : undefined;
function fail(code: string): never { throw new RecoveryError(code); }
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('\0') === keys.sort().join('\0');

function privateDirectory(s: Stats): void {
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid!() || (s.mode & 0o077) !== 0) fail('JOURNAL_UNSAFE_DIRECTORY');
}
function privateFile(s: Stats): void {
  if (!s.isFile() || s.nlink !== 1 || s.uid !== process.getuid!() || (s.mode & 0o077) !== 0 || s.size > MAX_RECORD_BYTES) fail('JOURNAL_UNSAFE_FILE');
}
async function syncDirectory(path: string): Promise<void> {
  const fd = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { privateDirectory(await fd.stat()); await fd.sync(); } finally { await fd.close(); }
}
function validatedReceipt(value: unknown): EditReceipt {
  if (!object(value) || !exact(value, ['path', 'bytes', 'beforeSha256', 'afterSha256', ...(Object.hasOwn(value, 'edits') ? ['edits'] : [])])) fail('JOURNAL_INVALID_RECEIPT');
  if (typeof value.path !== 'string' || !value.path || value.path.length > 4096 || isAbsolute(value.path) || /[\0\\:\r\n]/u.test(value.path)
      || value.path.split('/').some(p => p === '..' || p === '.' || p === '')
      || !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 0 || Number(value.bytes) > 1048576
      || typeof value.beforeSha256 !== 'string' || !SHA.test(value.beforeSha256)
      || typeof value.afterSha256 !== 'string' || !SHA.test(value.afterSha256)
      || (value.edits !== undefined && (!Number.isSafeInteger(value.edits) || Number(value.edits) < 1 || Number(value.edits) > 100))) fail('JOURNAL_INVALID_RECEIPT');
  return structuredClone(value) as unknown as EditReceipt;
}

// These records detect accidental corruption, not malicious modifications by the same OS user.
async function readRecord(path: string): Promise<Record<string, unknown>> {
  const meta = await lstat(path); privateFile(meta);
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await fd.stat(); privateFile(before);
    if (before.dev !== meta.dev || before.ino !== meta.ino) fail('JOURNAL_UNSAFE_FILE');
    const bytes = Buffer.alloc(MAX_RECORD_BYTES + 1); let length = 0;
    while (length < bytes.length) {
      const r = await fd.read(bytes, length, bytes.length - length, null); if (!r.bytesRead) break; length += r.bytesRead;
    }
    if (length > MAX_RECORD_BYTES) fail('JOURNAL_INVALID_RECORD');
    const after = await fd.stat();
    if (before.size !== length || before.size !== after.size || before.ctimeMs !== after.ctimeMs || before.mtimeMs !== after.mtimeMs) fail('JOURNAL_INVALID_RECORD');
    let envelope: unknown;
    try { envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))); }
    catch { fail('JOURNAL_INVALID_RECORD'); }
    if (!object(envelope) || !exact(envelope, ['payload', 'sha256']) || !object(envelope.payload)
        || envelope.sha256 !== hash(JSON.stringify(envelope.payload))) fail('JOURNAL_INVALID_RECORD');
    return envelope.payload;
  } finally { await fd.close(); }
}
async function writeRecord(path: string, payload: Record<string, unknown>): Promise<void> {
  const encoded = JSON.stringify({ payload, sha256: hash(JSON.stringify(payload)) }) + '\n';
  if (Buffer.byteLength(encoded) > MAX_RECORD_BYTES) fail('JOURNAL_INVALID_RECORD');
  const temporary = join(dirname(path), `.pending-${randomUUID()}`);
  const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    try { await file.writeFile(encoded); await file.sync(); } finally { await file.close(); }
    // There is exactly one cooperative owner for a claimed operation. No public finish API exists.
    await rename(temporary, path); await syncDirectory(dirname(path));
  } finally { await rm(temporary, { force: true }); }
}

/**
 * Optional POSIX local-filesystem journal. Persistent operation-ID reservation,
 * not atomic file/log transactions and not a cross-process file mutation lock.
 * No automatic stale-lock removal, operation eviction, rollback or retry.
 */
export class DurableMutationJournal implements MutationJournalBackend {
  private readonly pending = new Map<string, { fingerprint: string; result: Promise<unknown> }>();
  private readonly scopes: Set<string>;
  private constructor(readonly directory: string, scopes: string[], private readonly capacity: number,
    private readonly lockWaitMs: number, private readonly identity: string) { this.scopes = new Set(scopes); }

  static async open(options: JournalOptions): Promise<DurableMutationJournal> {
    if (!['linux', 'darwin'].includes(process.platform) || !process.getuid) fail('JOURNAL_PLATFORM_UNSUPPORTED');
    const { directory, workspaceRoots, capacity = 1024, lockWaitMs = 2000, openMode = 'create-or-open' } = options;
    if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('\0') || !Array.isArray(workspaceRoots) || !workspaceRoots.length
        || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10000 || !Number.isSafeInteger(lockWaitMs) || lockWaitMs < 1 || lockWaitMs > 30000) fail('JOURNAL_INVALID_CONFIG');
    if (!['create-or-open', 'existing-only', 'create-only'].includes(openMode)) fail('JOURNAL_INVALID_CONFIG');
    const target = join(await realpath(dirname(directory)), basename(directory));
    const roots = await Promise.all(workspaceRoots.map(async root => {
      if (typeof root !== 'string' || !isAbsolute(root) || root.includes('\0')) fail('JOURNAL_INVALID_CONFIG');
      const canonical = await realpath(root); if (!(await lstat(canonical)).isDirectory()) fail('JOURNAL_INVALID_CONFIG'); return mutationPath(canonical);
    }));
    if (roots.some(root => inside(mutationPath(target), root) || inside(root, mutationPath(target)))) fail('JOURNAL_WORKSPACE_OVERLAP');
    let created = false;
    if (openMode === 'existing-only') {
      try { await lstat(target); }
      catch (e) { if (errorCode(e) === 'ENOENT') fail('JOURNAL_NOT_INITIALIZED'); throw e; }
    } else {
      try { await mkdir(target, { mode: 0o700 }); created = true; }
      catch (e) {
        if (errorCode(e) !== 'EEXIST') throw e;
        if (openMode === 'create-only') fail('JOURNAL_ALREADY_EXISTS');
      }
    }
    const info = await lstat(target); privateDirectory(info);
    const journal = new DurableMutationJournal(target, roots, capacity, lockWaitMs, `${info.dev}:${info.ino}`);
    // Existing uninitialized/corrupt directories are not silently reset.
    const metadata = { version: 1, capacity, scopeHashes: [...new Set(roots.map(hash))].sort() };
    if (created) {
      await writeRecord(join(target, 'metadata.json'), metadata);
      // Parent need not be private; only request persistence, not change its permissions.
      const parent = await open(dirname(target), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try { await parent.sync(); } finally { await parent.close(); }
    } else {
      const stored = await readRecord(join(target, 'metadata.json'));
      if (JSON.stringify(stored) !== JSON.stringify(metadata)) fail('JOURNAL_CONFIG_MISMATCH');
    }
    await journal.assertIdentity(); return journal;
  }

  private async assertIdentity(): Promise<void> {
    const info = await lstat(this.directory); privateDirectory(info);
    if (`${info.dev}:${info.ino}` !== this.identity) fail('JOURNAL_REPLACED');
  }
  private key(scope: string, id: string): string {
    if (!this.scopes.has(scope) || typeof id !== 'string' || !OP.test(id)) fail('JOURNAL_INVALID_OPERATION');
    return `op-${hash(JSON.stringify([scope, id]))}`;
  }
  async inspect(scope: string, id: string): Promise<RecoveryState> {
    const key = this.key(scope, id); await this.assertIdentity();
    return this.inspectKey(key);
  }
  private async inspectKey(key: string): Promise<RecoveryState> {
    const dir = join(this.directory, key);
    try { privateDirectory(await lstat(dir)); } catch (e) { if (errorCode(e) === 'ENOENT') return { state: 'absent' }; throw e; }
    try {
      const begin = await readRecord(join(dir, 'begin.json'));
      if (!exact(begin, ['version', 'key', 'fingerprint', 'state']) || begin.version !== 1 || begin.key !== key || begin.state !== 'started'
          || typeof begin.fingerprint !== 'string' || !SHA.test(begin.fingerprint)) fail('JOURNAL_INVALID_RECORD');
      let terminal: Record<string, unknown>;
      try { terminal = await readRecord(join(dir, 'terminal.json')); }
      catch (e) { if (errorCode(e) === 'ENOENT') return { state: 'unresolved', reason: 'unfinished_or_active' }; throw e; }
      if (terminal.version !== 1 || terminal.key !== key || terminal.fingerprint !== begin.fingerprint) fail('JOURNAL_INVALID_RECORD');
      if (terminal.state === 'failed' && exact(terminal, ['version', 'key', 'fingerprint', 'state'])) return { state: 'failed', fingerprint: begin.fingerprint };
      if (terminal.state === 'succeeded' && exact(terminal, ['version', 'key', 'fingerprint', 'state', 'receipt'])) {
        return { state: 'succeeded', fingerprint: begin.fingerprint, receipt: validatedReceipt(terminal.receipt) };
      }
      fail('JOURNAL_INVALID_RECORD');
    } catch (e) {
      if (errorCode(e) === 'ENOENT' || (e instanceof RecoveryError && ['JOURNAL_INVALID_RECORD', 'JOURNAL_INVALID_RECEIPT'].includes(e.code))) {
        return { state: 'unresolved', reason: 'invalid_record' };
      }
      throw e;
    }
  }
  /** Local operator inventory only. No ID recovery, raw receipts or lock acquisition. */
  async inventory(options: { limit?: number; after?: string } = {}): Promise<JournalInventory> {
    const { limit = 100, after } = options;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 ||
        (after !== undefined && !/^op-[a-f0-9]{64}$/.test(after)) ||
        Object.keys(options).some(key => key !== 'limit' && key !== 'after')) fail('JOURNAL_INVALID_INSPECTION');
    await this.assertIdentity();
    const expected = { version: 1, capacity: this.capacity, scopeHashes: [...this.scopes].map(hash).sort() };
    if (JSON.stringify(await readRecord(join(this.directory, 'metadata.json'))) !== JSON.stringify(expected)) fail('JOURNAL_CONFIG_MISMATCH');
    const keys: string[] = []; let lockObserved = false, seen = 0, metadataSeen = false;
    const directory = await opendir(this.directory, { bufferSize: 32 });
    for await (const entry of directory) {
      if (++seen > this.capacity + 2) fail('JOURNAL_INSPECTION_LIMIT');
      if (entry.name === 'metadata.json') { metadataSeen = true; continue; }
      if (entry.name === '.allocation-lock') {
        privateDirectory(await lstat(join(this.directory, entry.name))); lockObserved = true; continue;
      }
      if (!/^op-[a-f0-9]{64}$/.test(entry.name)) fail('JOURNAL_UNEXPECTED_ENTRY');
      if (keys.length >= this.capacity) fail('JOURNAL_INSPECTION_LIMIT');
      keys.push(entry.name);
    }
    if (!metadataSeen) fail('JOURNAL_INVALID_RECORD');
    keys.sort();
    const remaining = after === undefined ? keys : keys.filter(key => key > after);
    const selected = remaining.slice(0, limit);
    const records: JournalInventoryEntry[] = [];
    for (const reference of selected) {
      await this.assertIdentity();
      try {
        const recordDirectory = join(this.directory, reference);
        privateDirectory(await lstat(recordDirectory));
        let unexpected = false, childrenSeen = 0;
        const children = await opendir(recordDirectory, { bufferSize: 4 });
        for await (const child of children) {
          if (++childrenSeen > 2 || !['begin.json', 'terminal.json'].includes(child.name)) { unexpected = true; break; }
        }
        if (unexpected) {
          records.push({ reference, state: 'blocked', reason: 'unexpected_record_entry', automaticRetry: false, nextAction: 'operator_review' });
          continue;
        }
        const state = await this.inspectKey(reference);
        records.push({ reference, ...summarizeRecoveryState(state) });
      } catch (error) {
        // Only a bounded diagnostic code is exposed; never leak exception paths or payloads.
        if (errorCode(error) === 'ENOENT') {
          records.push({ reference, state: 'unresolved', reason: 'invalid_record', automaticRetry: false, nextAction: 'operator_review' });
          continue;
        }
        const code = error instanceof RecoveryError ? error.code : undefined;
        if (!['JOURNAL_UNSAFE_DIRECTORY', 'JOURNAL_UNSAFE_FILE'].includes(code ?? '')) throw error;
        records.push({ reference, state: 'blocked', reason: 'unsafe_record', automaticRetry: false, nextAction: 'operator_review' });
      }
    }
    await this.assertIdentity();
    if (JSON.stringify(await readRecord(join(this.directory, 'metadata.json'))) !== JSON.stringify(expected)) fail('JOURNAL_CONFIG_MISMATCH');
    return { schema: 1, mode: 'read-only', scope: 'local-operator', atomicSnapshot: false,
      allocationLock: lockObserved ? 'observed_present' : 'not_observed', ownerLiveness: 'not_inferred',
      totalObserved: keys.length, records, nextCursor: remaining.length > selected.length ? selected.at(-1)! : null,
      capacity: this.capacity, capacityRemainingObserved: this.capacity - keys.length,
      automaticRetry: false, changedRecords: false };
  }
  private fromExisting<T>(state: RecoveryState, fingerprint: string): OperationResult<T> | undefined {
    if (state.state === 'absent') return undefined;
    if (state.state === 'unresolved') fail('OPERATION_OUTCOME_UNKNOWN');
    if (state.fingerprint !== fingerprint) fail('OPERATION_ID_CONFLICT');
    if (state.state === 'failed') fail('OPERATION_PREVIOUSLY_FAILED');
    return { value: structuredClone(state.receipt) as T, replayed: true };
  }
  async run<T>(scope: string, id: string, fingerprint: string, action: () => Promise<T>): Promise<OperationResult<T>> {
    const key = this.key(scope, id);
    if (typeof fingerprint !== 'string' || !SHA.test(fingerprint)) fail('JOURNAL_INVALID_OPERATION');
    const inflight = this.pending.get(key);
    if (inflight) {
      if (inflight.fingerprint !== fingerprint) fail('OPERATION_ID_CONFLICT');
      return { value: structuredClone(await inflight.result) as T, replayed: true };
    }
    // Reserve in-process synchronously; only this instance can join an active promise.
    const work = Promise.resolve().then(() => this.execute(scope, id, key, fingerprint, action));
    const result = work.then(r => r.value);
    void result.catch(() => {}); this.pending.set(key, { fingerprint, result });
    try { return await work; } finally { this.pending.delete(key); }
  }
  private async allocate<T>(scope: string, id: string, key: string, fingerprint: string): Promise<OperationResult<T> | undefined> {
    const lock = join(this.directory, '.allocation-lock'); const deadline = performance.now() + this.lockWaitMs;
    for (;;) {
      await this.assertIdentity();
      try { await mkdir(lock, { mode: 0o700 }); break; }
      catch (e) { if (errorCode(e) !== 'EEXIST') throw e; if (performance.now() >= deadline) fail('JOURNAL_ALLOCATION_LOCKED'); await pause(10); }
    }
    try {
      const existing = this.fromExisting<T>(await this.inspect(scope, id), fingerprint); if (existing) return existing;
      const entries = await readdir(this.directory);
      if (entries.some(name => name !== 'metadata.json' && name !== '.allocation-lock' && !/^op-[a-f0-9]{64}$/.test(name))) fail('JOURNAL_UNEXPECTED_ENTRY');
      if (entries.filter(name => name.startsWith('op-')).length >= this.capacity) fail('OPERATION_JOURNAL_FULL');
      const dir = join(this.directory, key);
      await mkdir(dir, { mode: 0o700 }); await syncDirectory(this.directory);
      await writeRecord(join(dir, 'begin.json'), { version: 1, key, fingerprint, state: 'started' });
      return undefined;
    } finally {
      // A crash can leave the allocation lock. Never remove another process's lock on reopen.
      await rmdir(lock); await syncDirectory(this.directory);
    }
  }
  private async execute<T>(scope: string, id: string, key: string, fingerprint: string, action: () => Promise<T>): Promise<OperationResult<T>> {
    const previous = this.fromExisting<T>(await this.inspect(scope, id), fingerprint); if (previous) return previous;
    const raced = await this.allocate<T>(scope, id, key, fingerprint); if (raced) return raced;
    const dir = join(this.directory, key);
    let value: T;
    try { value = await action(); }
    catch (originalError) {
      // Failure may already have effects. Record only a terminal failure, never a no-effect guarantee.
      try { await writeRecord(join(dir, 'terminal.json'), { version: 1, key, fingerprint, state: 'failed' }); }
      catch { fail('OPERATION_OUTCOME_UNKNOWN'); }
      throw originalError;
    }
    try {
      const receipt = validatedReceipt(value);
      await writeRecord(join(dir, 'terminal.json'), { version: 1, key, fingerprint, state: 'succeeded', receipt });
      return { value: structuredClone(receipt) as T, replayed: false };
    } catch { fail('OPERATION_OUTCOME_UNKNOWN'); }
  }
}
