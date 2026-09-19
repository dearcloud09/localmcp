import { z } from 'zod';
import { ToolRegistry, type Backend, type Feature, type ToolDescriptor } from '../core/registry.js';
import type { ModuleContext } from './context.js';

export const workspaceName = z.string().optional();
export const withWorkspace = <T extends z.ZodRawShape>(shape: T) => z.object({ workspace: workspaceName, ...shape });
export type ModuleRegistry = ToolRegistry<ModuleContext>;
interface Definition<S extends z.ZodType> {
  name: string;
  module: string;
  backend?: Backend;
  schema: S;
  description?: string;
  readOnly: boolean;
  openWorld?: boolean;
  requires?: readonly Feature[];
  responseMode?: 'json' | 'mcp';
  isFailure?: (result: unknown) => boolean;
}
export function defineTool<S extends z.ZodType>(
  registry: ModuleRegistry,
  definition: Definition<S>,
  execute: (args: z.output<S>, context: ModuleContext) => unknown | Promise<unknown>,
): void {
  registry.register<z.output<S>>({
    name: definition.name,
    module: definition.module,
    backend: definition.backend ?? 'internal',
    description: definition.description ?? definition.name.replaceAll('_', ' '),
    inputSchema: z.toJSONSchema(definition.schema) as ToolDescriptor['inputSchema'],
    annotations: {
      readOnlyHint: definition.readOnly,
      destructiveHint: !definition.readOnly,
      openWorldHint: definition.openWorld ?? false,
    },
    requires: definition.requires,
    responseMode: definition.responseMode,
    isFailure: definition.isFailure,
    parse: raw => definition.schema.parse(raw) as z.output<S>,
    execute,
  });
}
