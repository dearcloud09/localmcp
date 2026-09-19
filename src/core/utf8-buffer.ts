import { StringDecoder } from 'node:string_decoder';

/** Byte cursors refer to the UTF-8 encoding of decoded text, never UTF-16 indices. */
export class Utf8TailBuffer {
  private readonly decoder = new StringDecoder('utf8');
  private data: Buffer = Buffer.alloc(0);
  private base = 0;
  private ended = false;
  constructor(private readonly maxBytes = 1024 * 1024) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 4) throw new Error('maxBytes must be an integer >= 4');
  }
  push(chunk: Buffer): void {
    if (this.ended) throw new Error('Output stream has ended');
    this.append(this.decoder.write(chunk));
  }
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.append(this.decoder.end());
  }
  private append(text: string): void {
    if (!text) return;
    const joined = Buffer.concat([this.data, Buffer.from(text, 'utf8')]);
    let drop = Math.max(0, joined.length - this.maxBytes);
    // A bounded tail may discard a whole character, but must not invent U+FFFD by cutting it.
    while (drop < joined.length && (joined[drop] & 0xc0) === 0x80) drop++;
    this.base += drop;
    // Copy: a tiny subarray must not retain the complete oversized output allocation.
    this.data = Buffer.from(joined.subarray(drop));
  }
  read(cursor = 0) {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Invalid output cursor');
    const end = this.base + this.data.length;
    let start = Math.min(Math.max(cursor - this.base, 0), this.data.length);
    const requestedStart = start;
    while (start < this.data.length && (this.data[start] & 0xc0) === 0x80) start++;
    return {
      text: this.data.subarray(start).toString('utf8'),
      nextCursor: end,
      truncatedBeforeCursor: cursor < this.base || start !== requestedStart,
    };
  }
}
