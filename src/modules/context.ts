import type { Config } from '../config.js';
import type { McpLoader } from '../mcp/loader.js';
import type { Skill } from '../skills/loader.js';
import type { ProcessManager } from '../process.js';
import { Workspace } from '../workspace.js';

export interface RuntimeSnapshot { config: Config; mcp: McpLoader; skills: Skill[] }
export interface ModuleContext extends RuntimeSnapshot { processes: ProcessManager }

export function selectWorkspace(context: ModuleContext, requested?: string) {
  const name = requested ?? context.config.defaultWorkspace;
  if (!Object.prototype.hasOwnProperty.call(context.config.workspaces, name)) throw new Error(`Unknown workspace '${name}'`);
  return { name, ws: new Workspace(context.config.workspaces[name]) };
}
