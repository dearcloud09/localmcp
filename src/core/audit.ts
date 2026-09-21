import type { AuditSink, Receipt } from './registry.js';

/** Bounded, process-local diagnostics. Not durable storage or a security audit ledger. */
export class RecentExecutions {
  private readonly records: Readonly<Receipt>[] = [];
  constructor(private readonly capacity = 200) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid receipt capacity');
  }
  readonly append: AuditSink = receipt => {
    this.records.push(Object.freeze({ ...receipt }));
    if (this.records.length > this.capacity) this.records.splice(0, this.records.length - this.capacity);
  };
  recent(): Readonly<Receipt>[] { return this.records.map(record => Object.freeze({ ...record })); }
}
