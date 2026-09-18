import { z } from 'zod';
import { FILE_READ_REQUIREMENTS, FILE_WRITE_REQUIREMENTS } from '../core/file-permissions.js';
import { defineTool, withWorkspace, type ModuleRegistry } from './define.js';
import { selectWorkspace } from './context.js';

export function registerFileTools(registry: ModuleRegistry): void {
  const read = { module: 'files', requires: FILE_READ_REQUIREMENTS, readOnly: true };
  const write = { ...read, requires: FILE_WRITE_REQUIREMENTS, readOnly: false };
  defineTool(registry, { ...read, name: 'list_directory', schema: withWorkspace({ path: z.string().default('.'), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(500).default(100) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.list(a.path, a.offset, a.limit));
  defineTool(registry, { ...read, name: 'workspace_tree', schema: withWorkspace({ path: z.string().default('.'), maxDepth: z.number().int().min(1).max(20).default(3), maxEntries: z.number().int().min(1).max(5000).default(1000) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.tree(a.path, a.maxDepth, a.maxEntries));
  defineTool(registry, { ...read, name: 'stat_path', schema: withWorkspace({ path: z.string() }) }, (a, c) => selectWorkspace(c, a.workspace).ws.stat(a.path));
  defineTool(registry, { ...read, name: 'find_files', schema: withWorkspace({ path: z.string().default('.'), pattern: z.string().min(1), maxResults: z.number().int().min(1).max(1000).default(100) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.findFiles(a.path, a.pattern, a.maxResults));
  defineTool(registry, { ...read, name: 'search_files', schema: withWorkspace({ path: z.string().default('.'), query: z.string().min(1), regex: z.boolean().default(false), caseSensitive: z.boolean().default(false), maxResults: z.number().int().min(1).max(500).default(100), contextLines: z.number().int().min(0).max(10).default(0) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.search(a.path, a.query, a.regex, a.caseSensitive, a.maxResults, a.contextLines));
  defineTool(registry, { ...read, name: 'read_file', schema: withWorkspace({ path: z.string() }) }, async (a, c) => ({ path: a.path, content: await selectWorkspace(c, a.workspace).ws.read(a.path) }));
  defineTool(registry, { ...read, name: 'read_file_lines', schema: withWorkspace({ path: z.string(), startLine: z.number().int().min(1).default(1), endLine: z.number().int().min(1).optional() }) }, (a, c) => selectWorkspace(c, a.workspace).ws.readLines(a.path, a.startLine, a.endLine));
  defineTool(registry, { ...write, name: 'write_file', schema: withWorkspace({ path: z.string(), content: z.string().max(1048576), overwrite: z.boolean().default(false) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.write(a.path, a.content, a.overwrite));
  defineTool(registry, { ...write, name: 'edit_file', schema: withWorkspace({ path: z.string(), oldText: z.string().min(1), newText: z.string() }) }, async (a, c) => {
    const { ws } = selectWorkspace(c, a.workspace);
    const original = await ws.read(a.path);
    const index = original.indexOf(a.oldText);
    if (index < 0 || original.indexOf(a.oldText, index + 1) >= 0) throw new Error('oldText must match exactly once');
    return ws.write(a.path, original.slice(0, index) + a.newText + original.slice(index + a.oldText.length), true);
  });
  defineTool(registry, { ...write, name: 'apply_patch', schema: withWorkspace({ path: z.string(), expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), edits: z.array(z.object({ startLine: z.number().int().min(1), endLine: z.number().int().min(1), replacement: z.string() })).min(1).max(100) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.applyEdits(a.path, a.edits, a.expectedSha256));
  defineTool(registry, { ...write, name: 'create_directory', schema: withWorkspace({ path: z.string() }) }, (a, c) => selectWorkspace(c, a.workspace).ws.createDirectory(a.path));
  defineTool(registry, { ...write, name: 'delete_path', schema: withWorkspace({ path: z.string(), recursive: z.boolean().default(false) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.delete(a.path, a.recursive));
  defineTool(registry, { ...write, name: 'move_path', schema: withWorkspace({ from: z.string(), to: z.string(), overwrite: z.boolean().default(false) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.move(a.from, a.to, a.overwrite));
}
