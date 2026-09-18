import { z } from 'zod';
import { readGitStatus } from '../adapters/git.js';
import { defineTool, withWorkspace, type ModuleRegistry } from './define.js';
import { selectWorkspace } from './context.js';

export function registerGitTools(registry: ModuleRegistry): void {
  defineTool(registry, {
    name: 'git_status', module: 'git', backend: 'cli',
    schema: withWorkspace({ maxResults: z.number().int().min(1).max(2000).default(200) }),
    // Do not use the dedicated adapter as a back door around an operator's shell=false setting.
    requires: ['files', 'shell'], readOnly: true, openWorld: true,
    description: 'Read Git working-tree status using a fixed local CLI adapter. Requires the workspace to be the Git root; no commit, push, fetch or automatic shell fallback.',
  }, (a, c) => readGitStatus(selectWorkspace(c, a.workspace).ws.root, a.maxResults));
}
