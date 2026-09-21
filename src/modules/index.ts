import { ToolRegistry, type AuditSink } from '../core/registry.js';
import type { ModuleContext } from './context.js';
import { registerWorkspaceTools } from './workspaces.js';
import { registerFileTools } from './files.js';
import { registerProcessTools } from './processes.js';
import { registerSkillTools } from './skills.js';
import { registerExternalMcpTools } from './external-mcp.js';
import { registerCheckTools } from './checks.js';
import { registerGitTools } from './git.js';

export function createToolRegistry(audit?: AuditSink): ToolRegistry<ModuleContext> {
  const registry = new ToolRegistry<ModuleContext>(audit);
  registerWorkspaceTools(registry);
  registerFileTools(registry);
  registerExternalMcpTools(registry);
  registerSkillTools(registry);
  registerProcessTools(registry);
  registerGitTools(registry);
  registerCheckTools(registry);
  return registry;
}
