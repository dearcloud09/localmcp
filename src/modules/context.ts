import type { Config } from '../config.js';
import type { McpLoader } from '../mcp/loader.js';
import type { Skill } from '../skills/loader.js';
import type { ProcessManager } from '../process.js';
import { selectFileWorkspace, type RuntimeMutations } from '../core/mutation-runtime.js';

export interface RuntimeSnapshot { config: Config; mcp: McpLoader; skills: Skill[]; mutations?: RuntimeMutations }
export interface ModuleContext extends RuntimeSnapshot { processes: ProcessManager }

export function selectWorkspace(context: ModuleContext, requested?: string) {
  return selectFileWorkspace(context, requested);
}
