import { z } from 'zod';
import { FILE_READ_REQUIREMENTS, FILE_WRITE_REQUIREMENTS } from '../core/file-permissions.js';
import { defineTool, withWorkspace, type ModuleRegistry } from './define.js';
import { selectWorkspace } from './context.js';

const expectedHash = z.string().regex(/^[a-f0-9]{64}$/).optional();
const operationId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/).optional();

export function registerFileTools(registry: ModuleRegistry): void {
  const read = { module: 'files', requires: FILE_READ_REQUIREMENTS, readOnly: true };
  const write = { ...read, requires: FILE_WRITE_REQUIREMENTS, readOnly: false };
  defineTool(registry, { ...read, name: 'list_directory', schema: withWorkspace({ path: z.string().default('.'), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(500).default(100) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.list(a.path, a.offset, a.limit));
  defineTool(registry, { ...read, name: 'workspace_tree', schema: withWorkspace({ path: z.string().default('.'), maxDepth: z.number().int().min(1).max(20).default(3), maxEntries: z.number().int().min(1).max(5000).default(1000) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.tree(a.path, a.maxDepth, a.maxEntries));
  defineTool(registry, { ...read, name: 'stat_path', schema: withWorkspace({ path: z.string() }) }, (a, c) => selectWorkspace(c, a.workspace).ws.stat(a.path));
  defineTool(registry, { ...read, name: 'find_files', schema: withWorkspace({ path: z.string().default('.'), pattern: z.string().min(1), maxResults: z.number().int().min(1).max(1000).default(100) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.findFiles(a.path, a.pattern, a.maxResults));
  defineTool(registry, { ...read, name: 'search_files', schema: withWorkspace({ path: z.string().default('.'), query: z.string().min(1), regex: z.boolean().default(false), caseSensitive: z.boolean().default(false), maxResults: z.number().int().min(1).max(500).default(100), contextLines: z.number().int().min(0).max(10).default(0) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.search(a.path, a.query, a.regex, a.caseSensitive, a.maxResults, a.contextLines));
  defineTool(registry, { ...read, name: 'read_file', description: 'Read a UTF-8 file. Set includeVersion=true to obtain the exact SHA-256 for a guarded edit.', schema: withWorkspace({ path: z.string(), includeVersion: z.boolean().default(false) }) }, async (a, c) => {
    const version = await selectWorkspace(c, a.workspace).ws.readVersion(a.path);
    return a.includeVersion ? { path: a.path, content: version.content, sha256: version.sha256, bytes: version.bytes } : { path: a.path, content: version.content };
  });
  defineTool(registry, { ...read, name: 'read_file_lines', schema: withWorkspace({ path: z.string(), startLine: z.number().int().min(1).default(1), endLine: z.number().int().min(1).optional() }) }, (a, c) => selectWorkspace(c, a.workspace).ws.readLines(a.path, a.startLine, a.endLine));
  defineTool(registry, { ...write, name: 'write_file', schema: withWorkspace({ path: z.string(), content: z.string().max(1048576), overwrite: z.boolean().default(false) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.write(a.path, a.content, a.overwrite));
  defineTool(registry, { ...write, name: 'edit_file', description: 'Replace exactly one match. Prefer expectedSha256 from read_file(includeVersion=true). An operationId requires that hash and deduplicates identical requests using the configured journal (see workspace_info.mutationRecovery); a replay is a historical receipt, not current file state.', schema: withWorkspace({ path: z.string(), oldText: z.string().min(1), newText: z.string(), expectedSha256: expectedHash, operationId }) }, (a, c) => selectWorkspace(c, a.workspace).ws.editText(a.path, a.oldText, a.newText, { expectedSha256: a.expectedSha256, operationId: a.operationId }));
  defineTool(registry, { ...write, name: 'apply_patch', description: 'Apply nonoverlapping line edits. Prefer expectedSha256 and a unique operationId. Identical retries return a historical receipt within the configured journal scope; never retry with a different payload under the same ID.', schema: withWorkspace({ path: z.string(), expectedSha256: expectedHash, operationId, edits: z.array(z.object({ startLine: z.number().int().min(1), endLine: z.number().int().min(1), replacement: z.string() })).min(1).max(100) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.applyEdits(a.path, a.edits, a.expectedSha256, a.operationId));
  defineTool(registry, { ...write, name: 'create_directory', schema: withWorkspace({ path: z.string() }) }, (a, c) => selectWorkspace(c, a.workspace).ws.createDirectory(a.path));
  defineTool(registry, { ...write, name: 'delete_path', schema: withWorkspace({ path: z.string(), recursive: z.boolean().default(false) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.delete(a.path, a.recursive));
  defineTool(registry, { ...write, name: 'move_path', schema: withWorkspace({ from: z.string(), to: z.string(), overwrite: z.boolean().default(false) }) }, (a, c) => selectWorkspace(c, a.workspace).ws.move(a.from, a.to, a.overwrite));
}
