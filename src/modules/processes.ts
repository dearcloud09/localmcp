import { z } from 'zod';
import { runCommand } from '../command.js';
import { defineTool, withWorkspace, type ModuleRegistry } from './define.js';
import { selectWorkspace } from './context.js';

export function registerProcessTools(registry: ModuleRegistry): void {
  defineTool(registry, {
    name: 'run_command', module: 'processes', backend: 'cli', readOnly: false, openWorld: true, requires: ['shell'],
    schema: withWorkspace({ command: z.string().min(1).max(32000), cwd: z.string().default('.'), timeoutMs: z.number().int().min(100).max(120000).default(30000) }),
    isFailure: result => result !== null && typeof result === 'object'
      && (('exitCode' in result && result.exitCode !== 0) || ('timedOut' in result && result.timedOut === true)),
  }, async (a, c) => runCommand(a.command, await selectWorkspace(c, a.workspace).ws.path(a.cwd), a.timeoutMs));
  const base = { module: 'processes', backend: 'cli' as const, openWorld: true, requires: ['shell', 'processes'] as const };
  defineTool(registry, { ...base, name: 'start_process', readOnly: false, schema: withWorkspace({ command: z.string().min(1).max(32000), cwd: z.string().default('.') }) }, async (a, c) => c.processes.start(a.command, await selectWorkspace(c, a.workspace).ws.path(a.cwd)));
  defineTool(registry, { ...base, name: 'read_process', readOnly: true, schema: z.object({ processId: z.string().uuid(), stdoutCursor: z.number().int().min(0).default(0), stderrCursor: z.number().int().min(0).default(0) }) }, (a, c) => c.processes.read(a.processId, a.stdoutCursor, a.stderrCursor));
  defineTool(registry, { ...base, name: 'write_process', readOnly: false, schema: z.object({ processId: z.string().uuid(), input: z.string().max(1048576) }) }, (a, c) => c.processes.write(a.processId, a.input));
  defineTool(registry, { ...base, name: 'stop_process', readOnly: false, schema: z.object({ processId: z.string().uuid() }) }, (a, c) => c.processes.stop(a.processId));
  defineTool(registry, { ...base, name: 'list_processes', readOnly: true, schema: z.object({}) }, (_a, c) => c.processes.list());
}
