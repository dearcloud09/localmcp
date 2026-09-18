import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export type Backend = 'internal' | 'cli' | 'mcp';
export type Feature = 'files' | 'shell' | 'processes';
export interface FeatureContext {
  config: { files: boolean; shell: boolean; processes: boolean };
}
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: { type: 'object'; [key: string]: unknown };
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean };
}
export interface Receipt {
  id: string;
  tool: string;
  module?: string;
  backend?: Backend;
  startedAt: string;
  durationMs: number;
  outcome: 'succeeded' | 'failed' | 'denied' | 'invalid_arguments';
  errorCode?: string;
}
export type AuditSink = (receipt: Readonly<Receipt>) => void;
export interface ToolDefinition<C, A> extends ToolDescriptor {
  module: string;
  backend: Backend;
  requires?: readonly Feature[];
  parse: (raw: unknown) => A;
  execute: (args: A, context: C) => unknown | Promise<unknown>;
  /** Preserve an upstream MCP response, including images and isError. */
  responseMode?: 'json' | 'mcp';
  /** A returned nonzero command exit must not be logged as successful execution. */
  isFailure?: (result: unknown) => boolean;
}
interface Registered<C> {
  descriptor: ToolDescriptor;
  module: string;
  backend: Backend;
  requires: readonly Feature[];
  parse: (raw: unknown) => unknown;
  execute: (args: unknown, context: C) => unknown | Promise<unknown>;
  responseMode: 'json' | 'mcp';
  isFailure?: (result: unknown) => boolean;
}
export class ToolDispatchError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ToolDispatchError';
  }
}

/** No transport, subprocess, network or model dependency in this registry. */
export class ToolRegistry<C extends FeatureContext> {
  private readonly tools = new Map<string, Registered<C>>();

  constructor(private readonly audit?: AuditSink) {}

  register<A>(definition: ToolDefinition<C, A>): void {
    if (this.tools.has(definition.name)) throw new Error(`Duplicate tool: ${definition.name}`);
    if (!/^[a-z][a-z0-9_]*$/.test(definition.name)) throw new Error('Invalid tool name');
    const { name, description, inputSchema, annotations } = definition;
    this.tools.set(name, {
      descriptor: { name, description, inputSchema: structuredClone(inputSchema), annotations: { ...annotations } },
      module: definition.module,
      backend: definition.backend,
      requires: [...(definition.requires ?? [])],
      parse: definition.parse,
      // The parser and executor are captured together; the erased value never crosses registrations.
      execute: (args, context) => definition.execute(args as A, context),
      responseMode: definition.responseMode ?? 'json',
      isFailure: definition.isFailure,
    });
  }

  private enabled(tool: Registered<C>, context: C): boolean {
    return tool.requires.every(feature => context.config[feature] === true);
  }

  list(context: C): ToolDescriptor[] {
    return [...this.tools.values()]
      .filter(tool => this.enabled(tool, context))
      .map(tool => structuredClone(tool.descriptor));
  }

  async call(name: string, raw: unknown, context: C): Promise<{ result: unknown; responseMode: 'json' | 'mcp' }> {
    const started = performance.now();
    const tool = this.tools.get(name);
    const receipt: Receipt = {
      id: randomUUID(), tool: tool ? name : '<unknown>', module: tool?.module, backend: tool?.backend,
      startedAt: new Date().toISOString(), durationMs: 0, outcome: 'failed',
    };
    try {
      if (!tool || !this.enabled(tool, context)) {
        receipt.outcome = 'denied';
        throw new ToolDispatchError('TOOL_UNAVAILABLE', 'Unknown tool');
      }
      let args: unknown;
      try { args = tool.parse(raw === undefined ? {} : raw); }
      catch (cause) {
        receipt.outcome = 'invalid_arguments';
        throw new ToolDispatchError('INVALID_ARGUMENTS', cause instanceof Error ? cause.message : 'Invalid arguments', { cause });
      }
      const result = await tool.execute(args, context);
      const remoteError = tool.responseMode === 'mcp' && result !== null && typeof result === 'object'
        && 'isError' in result && result.isError === true;
      receipt.outcome = remoteError || tool.isFailure?.(result) ? 'failed' : 'succeeded';
      if (receipt.outcome === 'failed') receipt.errorCode = 'TOOL_REPORTED_FAILURE';
      return { result, responseMode: tool.responseMode };
    } catch (error) {
      receipt.errorCode = error instanceof ToolDispatchError ? error.code : 'EXECUTION_FAILED';
      throw error;
    } finally {
      receipt.durationMs = Math.max(0, performance.now() - started);
      // Never log arguments, file contents, stdout, URLs, tokens or exception messages.
      // A broken telemetry sink must not turn an already-applied edit into a retriable failure.
      try { this.audit?.(Object.freeze({ ...receipt })); } catch { /* best-effort diagnostics only */ }
    }
  }
}
