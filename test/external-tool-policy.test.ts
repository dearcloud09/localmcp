import test from 'node:test';
import assert from 'node:assert/strict';
import { ExternalToolPolicy, ExternalToolPolicyError, validateAllowedTools } from '../src/core/external-tool-policy.js';
const tool = (name = 'echo') => ({ name, description: 'echo a value', inputSchema: { type: 'object', properties: { text: { type: 'string' } } }, annotations: { readOnlyHint: true } });
const denied = (fn: () => unknown, code: string) => assert.throws(fn, e => e instanceof ExternalToolPolicyError && e.code === code);

test('external grants are explicit nonempty exact-name lists', () => {
  for (const value of [undefined, null, [], '*', ['*'], ['echo', 'echo'], [1], ['bad/name'], Array(257).fill('echo')]) {
    denied(() => validateAllowedTools(value), 'MCP_ALLOWLIST_REQUIRED');
  }
  assert.deepEqual(validateAllowedTools(['echo', 'other.tool-2']), ['echo', 'other.tool-2']);
});
test('local grants are copied, not mutated by a caller retaining the input array', () => {
  const allowed = ['echo']; const p = new ExternalToolPolicy(allowed); allowed.push('write');
  denied(() => p.assertAllowed('write'), 'MCP_TOOL_DENIED');
});
test('catalog filters unapproved tools even if their annotations claim read-only', () => {
  const p = new ExternalToolPolicy(['echo']); assert.deepEqual(p.accept([tool(), tool('write')]).map(x => x.name), ['echo']);
  denied(() => p.assertAllowed('write'), 'MCP_TOOL_DENIED');
});
test('empty or removed allowed catalogs do not create implicit permissions', () => {
  const p = new ExternalToolPolicy(['echo']); assert.deepEqual(p.accept([]), []);
  p.accept([tool()]); assert.deepEqual(p.accept([]), []); denied(() => p.assertAllowed('other'), 'MCP_TOOL_DENIED');
});
test('descriptor snapshots are detached from upstream and consumer mutation', () => {
  const p = new ExternalToolPolicy(['echo']); const source = tool(); const accepted = p.accept([source]);
  source.description = 'source mutation'; accepted[0].description = 'consumer mutation';
  assert.equal(p.accept([tool()])[0].description, 'echo a value');
});
test('equivalent object key order does not cause a false schema-change alarm', () => {
  const p = new ExternalToolPolicy(['echo']); p.accept([tool()]);
  const equivalent = { ...tool(), inputSchema: { properties: { text: { type: 'string' } }, type: 'object' } };
  assert.equal(p.accept([equivalent]).length, 1);
});
test('changed input schema is quarantined until a new operator-created policy instance', () => {
  const p = new ExternalToolPolicy(['echo']); p.accept([tool()]);
  const changed = { ...tool(), inputSchema: { type: 'object', properties: { text: { type: 'number' } } } };
  denied(() => p.accept([changed]), 'MCP_TOOL_CHANGED');
  denied(() => p.assertAllowed('echo'), 'MCP_TOOL_CHANGED');
  denied(() => p.accept([tool()]), 'MCP_TOOL_CHANGED');
  assert.equal(new ExternalToolPolicy(['echo']).accept([changed]).length, 1);
});
test('description and annotation changes also require local review', () => {
  for (const changed of [{ ...tool(), description: 'new instructions' }, { ...tool(), annotations: { readOnlyHint: false } }]) {
    const p = new ExternalToolPolicy(['echo']); p.accept([tool()]); denied(() => p.accept([changed]), 'MCP_TOOL_CHANGED');
  }
});
test('output schema changes cannot silently replace an approved descriptor', () => {
  const p = new ExternalToolPolicy(['echo']); p.accept([tool()]);
  denied(() => p.accept([{ ...tool(), outputSchema: { type: 'object' } }]), 'MCP_TOOL_CHANGED');
});
test('duplicate or invalid remote names are refused before publishing the catalog', () => {
  const p = new ExternalToolPolicy(['echo']); denied(() => p.accept([tool(), tool()]), 'MCP_INVALID_CATALOG');
  denied(() => p.accept([tool('bad/name')]), 'MCP_INVALID_CATALOG');
});
test('oversized descriptor and catalog do not become callable', () => {
  const p = new ExternalToolPolicy(['echo']); denied(() => p.accept([{ ...tool(), description: 'x'.repeat(65537) }]), 'MCP_DESCRIPTOR_LIMIT');
  denied(() => p.accept(Array(4097).fill(tool())), 'MCP_CATALOG_LIMIT');
});
test('recursive schema and malformed non-JSON descriptor are rejected', () => {
  const p = new ExternalToolPolicy(['echo']); const nested: Record<string, unknown> = {}; nested.self = nested;
  denied(() => p.accept([{ ...tool(), inputSchema: nested }]), 'MCP_SCHEMA_DEPTH');
  denied(() => p.accept([{ ...tool(), inputSchema: { value: undefined } }]), 'MCP_INVALID_DESCRIPTOR');
});
test('preauthorizing a future exact name does not permit any other newly advertised name', () => {
  const p = new ExternalToolPolicy(['echo', 'second']); p.accept([tool()]);
  assert.deepEqual(p.accept([tool(), tool('second'), tool('third')]).map(x => x.name), ['echo', 'second']);
});
test('policy errors do not echo arbitrary remote names or text', () => {
  const p = new ExternalToolPolicy(['echo']);
  assert.throws(() => p.assertAllowed('PRIVATE_SENTINEL'), e => e instanceof Error && !e.message.includes('PRIVATE_SENTINEL'));
});
