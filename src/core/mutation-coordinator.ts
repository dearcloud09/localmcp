import { isAbsolute, relative, resolve, sep } from 'node:path';

export class MutationError extends Error {
  constructor(readonly code: string) {
    super(code === 'FILE_VERSION_CONFLICT' ? `${code}: File changed since it was read (sha256 mismatch or metadata change)` : code);
    this.name = 'MutationError';
  }
}

/** Conservative alias handling; extra serialization on case-sensitive macOS is harmless. */
export function mutationPath(path: string): string {
  const absolute = resolve(path);
  return process.platform === 'darwin' || process.platform === 'win32'
    ? absolute.normalize('NFC').toLowerCase() : absolute;
}
const contains = (parent: string, child: string): boolean => {
  const suffix = relative(parent, child);
  return suffix === '' || (suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix));
};
const overlaps = (a: readonly string[], b: readonly string[]): boolean =>
  a.some(left => b.some(right => contains(left, right) || contains(right, left)));
interface Waiter { paths: string[]; start: () => void }

/** Process-local only. Ancestor/descendant mutations serialize; unrelated files do not. */
export class MutationQueue {
  private active = new Set<Waiter>();
  private waiting: Waiter[] = [];
  constructor(private readonly capacity = 1024) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new MutationError('INVALID_QUEUE_CAPACITY');
  }
  run<T>(paths: readonly string[], action: () => Promise<T>): Promise<T> {
    if (!paths.length || paths.some(path => typeof path !== 'string' || !isAbsolute(path) || path.includes('\0'))) {
      return Promise.reject(new MutationError('INVALID_MUTATION_PATH'));
    }
    if (this.active.size + this.waiting.length >= this.capacity) {
      return Promise.reject(new MutationError('MUTATION_QUEUE_FULL'));
    }
    return new Promise<T>((done, fail) => {
      const waiter: Waiter = {
        paths: [...new Set(paths.map(mutationPath))],
        start: () => {
          this.active.add(waiter);
          Promise.resolve().then(action).then(done, fail).finally(() => {
            this.active.delete(waiter);
            this.drain();
          });
        },
      };
      this.waiting.push(waiter);
      this.drain();
    });
  }
  private drain(): void {
    for (let i = 0; i < this.waiting.length;) {
      const candidate = this.waiting[i];
      // Preserve FIFO for conflicting requests without blocking disjoint paths.
      if ([...this.active].some(item => overlaps(item.paths, candidate.paths)) ||
          this.waiting.slice(0, i).some(item => overlaps(item.paths, candidate.paths))) { i++; continue; }
      this.waiting.splice(i, 1);
      candidate.start();
    }
  }
}

interface Entry { fingerprint: string; result: Promise<unknown> }
export interface OperationResult<T> { value: T; replayed: boolean }
export interface MutationJournalBackend {
  run<T>(scope: string, operationId: string, fingerprint: string, action: () => Promise<T>): Promise<OperationResult<T>>;
}

/**
 * No eviction/expiry: a forgotten operation must not silently run twice.
 * Stores digests and result receipts, never input contents. Failures stay reserved.
 * This is bounded in-memory deduplication, NOT durable exactly-once execution.
 */
export class MutationJournal {
  private entries = new Map<string, Entry>();
  constructor(private readonly capacity = 1024) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new MutationError('INVALID_JOURNAL_CAPACITY');
  }
  async run<T>(scope: string, operationId: string, fingerprint: string, action: () => Promise<T>): Promise<OperationResult<T>> {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(operationId) || !/^[a-f0-9]{64}$/.test(fingerprint)) {
      throw new MutationError('INVALID_OPERATION_ID_OR_FINGERPRINT');
    }
    const key = JSON.stringify([scope, operationId]);
    const previous = this.entries.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new MutationError('OPERATION_ID_CONFLICT');
      return { value: structuredClone(await previous.result) as T, replayed: true };
    }
    if (this.entries.size >= this.capacity) throw new MutationError('OPERATION_JOURNAL_FULL');
    // Reserve synchronously before scheduling execution, including concurrent callers.
    const result = Promise.resolve().then(action).then(value => structuredClone(value));
    const retained = result.catch(() => { throw new MutationError('OPERATION_PREVIOUSLY_FAILED'); });
    void retained.catch(() => {});
    this.entries.set(key, { fingerprint, result: retained });
    return { value: structuredClone(await result), replayed: false };
  }
}

// Shared across Workspace instances and configuration reloads in this Node process.
export const fileMutationQueue = new MutationQueue();
export const fileMutationJournal = new MutationJournal();
