import { z } from 'zod';
import { defineTool, withWorkspace, type ModuleRegistry } from './define.js';
import { selectWorkspace } from './context.js';
import { runSandboxCheck } from '../adapters/docker-snapshot.js';

export function registerCheckTools(registry: ModuleRegistry): void {
  defineTool(registry, {
    name: 'run_check', module: 'checks', backend: 'cli',
    description: 'Run an operator-configured check on a filtered disposable Docker snapshot. Use workspace_info.availableChecks. Requires a local installed image; no host fallback or writeback.',
    schema: withWorkspace({ check: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/) }),
    readOnly: false, openWorld: true, requires: ['files', 'fileRead', 'sandboxChecks'],
    isFailure: result => { const r = result as { exitCode?: unknown; timedOut?: boolean; truncated?: boolean }; return r.exitCode !== 0 || r.timedOut === true || r.truncated === true; },
  }, (args, context) => {
    const checks = context.config.checks ?? {};
    if (!Object.hasOwn(checks, args.check)) throw new Error('Unknown configured check');
    return runSandboxCheck(selectWorkspace(context, args.workspace).ws.root, checks[args.check]);
  });
}
