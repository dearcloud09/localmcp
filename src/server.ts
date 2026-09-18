import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from './config.js';
import type { McpLoader } from './mcp/loader.js';
import type { Skill } from './skills/loader.js';
import { ProcessManager } from './process.js';
import { RecentExecutions } from './core/audit.js';
import { createToolRegistry } from './modules/index.js';
import type { ModuleContext, RuntimeSnapshot } from './modules/context.js';

// Shared by stateless HTTP protocol-server instances in this process. No raw arguments/results.
export const recentExecutions = new RecentExecutions(200);

export async function createServer(
  config: Config,
  mcp: McpLoader,
  skills: Skill[],
  processes = new ProcessManager(),
  getRuntime: () => RuntimeSnapshot = () => ({ config, mcp, skills }),
) {
  const server = new Server({ name: 'localmcp', version: '0.3.0' }, { capabilities: { tools: {} } });
  const registry = createToolRegistry(recentExecutions.append);
  // Each call sees one consistent snapshot; later calls observe configuration hot reloads.
  const context = (): ModuleContext => ({ ...getRuntime(), processes });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: registry.list(context()) as Tool[] }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const { result, responseMode } = await registry.call(request.params.name, request.params.arguments, context());
      if (responseMode === 'mcp') return result as CallToolResult;
      const text = JSON.stringify(result);
      if (text === undefined) throw new Error('Tool returned no JSON result');
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Tool failed' }] };
    }
  });
  return server;
}
