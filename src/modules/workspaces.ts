import { z } from 'zod';
import { defineTool, workspaceName, type ModuleRegistry } from './define.js';
import { selectWorkspace } from './context.js';

export function registerWorkspaceTools(registry: ModuleRegistry): void {
  defineTool(registry, { name: 'workspace_info', module: 'workspaces', schema: z.object({ workspace: workspaceName }), readOnly: true }, (args, context) => {
    const { config, skills } = context;
    const selected = selectWorkspace(context, args.workspace);
    return {
      workspace: selected.name, root: selected.ws.root, defaultWorkspace: config.defaultWorkspace,
      configFile: config.configFile, files: config.files, shell: config.shell, processes: config.processes,
      // This scope does not constrain separately enabled shell or external MCP tools.
      filePermissions: { read: config.files && config.fileRead === true, write: config.files && config.fileRead === true && config.fileWrite === true, scope: 'file-tools' },
      skills: skills.map(skill => skill.name), mcpServers: Object.keys(config.mcpServers),
      fileLimitBytes: 1048576, persistentProcesses: config.shell,
    };
  });
  defineTool(registry, { name: 'list_workspaces', module: 'workspaces', schema: z.object({}), readOnly: true }, (_args, { config }) => ({
    defaultWorkspace: config.defaultWorkspace,
    workspaces: Object.entries(config.workspaces).map(([name, root]) => ({ name, root })),
  }));
}
