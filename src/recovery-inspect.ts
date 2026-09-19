#!/usr/bin/env node
// Operator-only read-only inspection. Deliberately not registered as an MCP tool.
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectRecovery, type InspectionOptions } from './core/recovery-inspection.js';

export function parseInspectionArguments(args: string[]): InspectionOptions {
  const values = new Map<string, string>(); const workspaceRoots: string[] = [];
  const valueFlags = new Set(['--directory', '--workspace', '--capacity', '--limit', '--after', '--operation', '--scope']);
  let compareCurrent = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--compare-current' && !compareCurrent) { compareCurrent = true; continue; }
    if (!valueFlags.has(flag) || values.has(flag)) throw new Error('INSPECTION_INVALID_ARGUMENTS');
    const value = args[++i];
    if (!value || value.startsWith('--') || /[\0\r\n]/u.test(value)) throw new Error('INSPECTION_INVALID_ARGUMENTS');
    if (flag === '--workspace') workspaceRoots.push(value); else values.set(flag, value);
  }
  const directory = values.get('--directory');
  if (!directory || !isAbsolute(directory) || workspaceRoots.length < 1 || workspaceRoots.length > 64 ||
      workspaceRoots.some(p => !isAbsolute(p))) throw new Error('INSPECTION_ABSOLUTE_PATHS_REQUIRED');
  const operationId = values.get('--operation'), scope = values.get('--scope');
  if ((operationId === undefined) !== (scope === undefined) || (compareCurrent && !operationId)) throw new Error('INSPECTION_OPERATION_SCOPE_REQUIRED');
  if ((scope !== undefined && !isAbsolute(scope)) || (operationId !== undefined && !/^[A-Za-z0-9_-]{8,128}$/.test(operationId))) throw new Error('INSPECTION_INVALID_OPERATION');
  const number = (flag: string, max: number): number | undefined => {
    const value = values.get(flag); if (value === undefined) return undefined;
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) > max) throw new Error('INSPECTION_INVALID_LIMIT');
    return Number(value);
  };
  const after = values.get('--after');
  if (after !== undefined && !/^op-[a-f0-9]{64}$/.test(after)) throw new Error('INSPECTION_INVALID_CURSOR');
  return { directory, workspaceRoots, capacity: number('--capacity', 10000), limit: number('--limit', 200),
    after, operationId, scope, compareCurrent };
}

export async function inspectionMain(args: string[]): Promise<number> {
  try {
    const report = await inspectRecovery(parseInspectionArguments(args));
    console.log(JSON.stringify(report, null, 2));
    return report.status === 'operator_review_required' ? 2 : 0;
  } catch (error) {
    const candidate = error instanceof Error ? ('code' in error ? error.code : error.message) : undefined;
    const code = typeof candidate === 'string' && /^(?:INSPECTION|JOURNAL)_[A-Z_]+$/.test(candidate) ? candidate : 'INSPECTION_BLOCKED';
    // No raw paths, arguments, exception messages, source, or stored receipt contents.
    console.error(JSON.stringify({ status: 'inspection_blocked', code, recordsChanged: false, actionsExecuted: false }));
    return 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await inspectionMain(process.argv.slice(2));
}
