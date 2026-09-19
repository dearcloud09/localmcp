import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry, ToolDispatchError, type FeatureContext, type Receipt } from '../src/core/registry.js';
import { RecentExecutions } from '../src/core/audit.js';
import { Utf8TailBuffer } from '../src/core/utf8-buffer.js';

const enabled = (): FeatureContext => ({ config: { files: true, shell: true, processes: true } });
const definition = () => ({
  name: 'echo', module: 'test', backend: 'internal' as const,
  description: 'echo', inputSchema: { type: 'object' as const },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  requires: ['files'] as const,
  parse: (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || !('value' in raw) || typeof raw.value !== 'string') throw new Error('value must be a string');
    return { value: raw.value };
  },
  execute: (a: { value: string }) => ({ value: a.value }),
});

test('registry dispatches an internal module without a transport', async () => {
  const registry = new ToolRegistry<FeatureContext>(); registry.register(definition());
  assert.deepEqual(await registry.call('echo', { value: 'hello' }, enabled()), { result: { value: 'hello' }, responseMode: 'json' });
});
test('duplicate and malformed tool registrations are rejected', () => {
  const registry = new ToolRegistry<FeatureContext>(); registry.register(definition());
  assert.throws(() => registry.register(definition()), /Duplicate/);
  assert.throws(() => registry.register({ ...definition(), name: 'bad name' }), /Invalid tool name/);
});
test('disabled tools are hidden and rejected even when directly called', async () => {
  let called = false; const registry = new ToolRegistry<FeatureContext>();
  registry.register({ ...definition(), execute: () => { called = true; } });
  const context = enabled(); context.config.files = false;
  assert.equal(registry.list(context).length, 0);
  await assert.rejects(registry.call('echo', { value: 'x' }, context), (error: unknown) => error instanceof ToolDispatchError && error.code === 'TOOL_UNAVAILABLE');
  assert.equal(called, false);
});
test('configuration changes affect the next invocation', async () => {
  const registry = new ToolRegistry<FeatureContext>(); registry.register(definition());
  const context = enabled(); assert.equal(registry.list(context).length, 1);
  context.config.files = false; assert.equal(registry.list(context).length, 0);
  context.config.files = true; assert.equal((await registry.call('echo', { value: 'restored' }, context)).responseMode, 'json');
});
test('all required features must be enabled', async () => {
  const registry = new ToolRegistry<FeatureContext>(); registry.register({ ...definition(), requires: ['files', 'shell'] });
  const context = enabled(); context.config.shell = false;
  await assert.rejects(registry.call('echo', { value: 'x' }, context));
});
test('schema failures do not execute a module', async () => {
  let called = false; const registry = new ToolRegistry<FeatureContext>();
  registry.register({ ...definition(), execute: () => { called = true; } });
  await assert.rejects(registry.call('echo', null, enabled()), (error: unknown) => error instanceof ToolDispatchError && error.code === 'INVALID_ARGUMENTS');
  assert.equal(called, false);
});
test('catalog mutation cannot change the registry', () => {
  const registry = new ToolRegistry<FeatureContext>(); registry.register(definition());
  const list = registry.list(enabled()); list[0].annotations.readOnlyHint = false; list[0].inputSchema.type = 'object';
  assert.equal(registry.list(enabled())[0].annotations.readOnlyHint, true);
});
test('MCP content and reported errors are preserved, not called success', async () => {
  const receipts: Readonly<Receipt>[] = [];
  const registry = new ToolRegistry<FeatureContext>(r => receipts.push(r));
  const upstream = { content: [{ type: 'image', data: 'opaque', mimeType: 'image/png' }], structuredContent: { ok: false }, isError: true };
  registry.register({ ...definition(), backend: 'mcp', responseMode: 'mcp', execute: () => upstream });
  const result = await registry.call('echo', { value: 'x' }, enabled());
  assert.strictEqual(result.result, upstream); assert.equal(result.responseMode, 'mcp'); assert.equal(receipts[0].outcome, 'failed');
});
test('nonzero CLI result is recorded as failed without changing result shape', async () => {
  const log = new RecentExecutions(); const registry = new ToolRegistry<FeatureContext>(log.append);
  registry.register({ ...definition(), backend: 'cli', execute: () => ({ exitCode: 7 }), isFailure: r => (r as { exitCode: number }).exitCode !== 0 });
  assert.deepEqual((await registry.call('echo', { value: 'x' }, enabled())).result, { exitCode: 7 });
  assert.equal(log.recent()[0].outcome, 'failed');
});
test('diagnostic sink errors never turn a completed operation into failure', async () => {
  let executions = 0; const registry = new ToolRegistry<FeatureContext>(() => { throw new Error('sink unavailable'); });
  registry.register({ ...definition(), execute: () => ++executions });
  assert.equal((await registry.call('echo', { value: 'x' }, enabled())).result, 1); assert.equal(executions, 1);
});
test('receipts are bounded and exclude input, output and exception messages', async () => {
  const log = new RecentExecutions(2); const registry = new ToolRegistry<FeatureContext>(log.append);
  registry.register({ ...definition(), execute: () => { throw new Error('TOKEN=secret'); } });
  for (let i = 0; i < 3; i++) await assert.rejects(registry.call('echo', { value: 'PRIVATE_SOURCE' }, enabled()));
  const recent = log.recent(); assert.equal(recent.length, 2);
  assert.ok(recent.every(r => r.outcome === 'failed' && r.durationMs >= 0));
  assert.doesNotMatch(JSON.stringify(recent), /secret|PRIVATE_SOURCE/);
});
test('denied and invalid invocations have distinct receipt states', async () => {
  const log = new RecentExecutions(); const registry = new ToolRegistry<FeatureContext>(log.append); registry.register(definition());
  await assert.rejects(registry.call('missing', {}, enabled()));
  await assert.rejects(registry.call('echo', {}, enabled()));
  assert.deepEqual(log.recent().map(r => r.outcome), ['denied', 'invalid_arguments']);
});

test('split Korean and emoji output is decoded without replacement characters', () => {
  const value = '가나다🙂끝'; const bytes = Buffer.from(value); const buffer = new Utf8TailBuffer();
  for (const byte of bytes) buffer.push(Buffer.from([byte]));
  buffer.end(); assert.equal(buffer.read().text, value); assert.equal(buffer.read().nextCursor, bytes.length);
});
test('partial characters remain pending between polling calls', () => {
  const buffer = new Utf8TailBuffer(); const bytes = Buffer.from('가');
  buffer.push(bytes.subarray(0, 1)); assert.deepEqual(buffer.read(), { text: '', nextCursor: 0, truncatedBeforeCursor: false });
  buffer.push(bytes.subarray(1)); assert.equal(buffer.read().text, '가'); assert.equal(buffer.read(3).text, '');
});
test('tail truncation preserves complete character boundaries', () => {
  const buffer = new Utf8TailBuffer(5); buffer.push(Buffer.from('가나다')); buffer.end();
  const result = buffer.read(); assert.equal(result.text, '다'); assert.equal(result.nextCursor, 9); assert.equal(result.truncatedBeforeCursor, true);
});
test('cursors inside a character are reported as truncated instead of corrupted', () => {
  const buffer = new Utf8TailBuffer(); buffer.push(Buffer.from('가나'));
  const result = buffer.read(1); assert.equal(result.text, '나'); assert.equal(result.truncatedBeforeCursor, true);
});
test('complete output can be read incrementally without duplicate bytes', () => {
  const buffer = new Utf8TailBuffer(); buffer.push(Buffer.from('one ')); const a = buffer.read();
  buffer.push(Buffer.from('둘')); const b = buffer.read(a.nextCursor);
  assert.equal(a.text + b.text, 'one 둘'); assert.equal(buffer.read(b.nextCursor).text, '');
});
test('invalid cursors and writes after close fail explicitly', () => {
  const buffer = new Utf8TailBuffer(); assert.throws(() => buffer.read(-1)); assert.throws(() => buffer.read(0.5));
  buffer.end(); buffer.end(); assert.throws(() => buffer.push(Buffer.from('x')));
});
