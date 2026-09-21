import { createHash } from 'node:crypto';

export class ExternalToolPolicyError extends Error {
  constructor(readonly code: string) {
    super(`${code}: External MCP policy denied the operation; review local configuration.`);
    this.name = 'ExternalToolPolicyError';
  }
}
const validName = (name: unknown): name is string => typeof name === 'string'
  && /^[A-Za-z0-9_.-]{1,128}$/u.test(name);
export function validateAllowedTools(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 256
    || value.some(name => !validName(name)) || new Set(value).size !== value.length) {
    throw new ExternalToolPolicyError('MCP_ALLOWLIST_REQUIRED');
  }
  return [...value];
}
export interface ExternalToolShape {
  name: string;
  inputSchema: unknown;
  description?: string;
  annotations?: unknown;
  outputSchema?: unknown;
}
function canonical(value: unknown, depth = 0): string {
  if (depth > 64) throw new ExternalToolPolicyError('MCP_SCHEMA_DEPTH');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(v => canonical(v, depth + 1)).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k], depth + 1)}`).join(',')}}`;
  }
  throw new ExternalToolPolicyError('MCP_INVALID_DESCRIPTOR');
}
function signature(tool: ExternalToolShape): string {
  const text = canonical({ inputSchema: tool.inputSchema, outputSchema: tool.outputSchema ?? null,
    description: tool.description ?? null, annotations: tool.annotations ?? null });
  if (Buffer.byteLength(text) > 65536) throw new ExternalToolPolicyError('MCP_DESCRIPTOR_LIMIT');
  return createHash('sha256').update(text).digest('hex');
}

/** Grants come only from local config. A server's readOnlyHint grants nothing. */
export class ExternalToolPolicy {
  private readonly allowed: ReadonlySet<string>;
  private readonly pins = new Map<string, string>();
  private readonly quarantined = new Set<string>();
  constructor(allowedTools: unknown) { this.allowed = new Set(validateAllowedTools(allowedTools)); }
  assertAllowed(name: string): void {
    if (!this.allowed.has(name)) throw new ExternalToolPolicyError('MCP_TOOL_DENIED');
    if (this.quarantined.has(name)) throw new ExternalToolPolicyError('MCP_TOOL_CHANGED');
  }
  accept<T extends ExternalToolShape>(tools: readonly T[]): T[] {
    if (tools.length > 4096) throw new ExternalToolPolicyError('MCP_CATALOG_LIMIT');
    const seen = new Set<string>();
    const accepted: T[] = [];
    const nextPins = new Map<string, string>();
    for (const tool of tools) {
      if (!validName(tool.name) || seen.has(tool.name)) throw new ExternalToolPolicyError('MCP_INVALID_CATALOG');
      seen.add(tool.name);
      if (!this.allowed.has(tool.name)) continue;
      this.assertAllowed(tool.name);
      const hash = signature(tool), before = this.pins.get(tool.name);
      if (before !== undefined && before !== hash) {
        this.quarantined.add(tool.name);
        throw new ExternalToolPolicyError('MCP_TOOL_CHANGED');
      }
      nextPins.set(tool.name, hash);
      accepted.push(structuredClone(tool));
    }
    for (const [name, hash] of nextPins) this.pins.set(name, hash);
    return accepted;
  }
}
