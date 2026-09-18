/** Run with the upstream npm dependencies installed. Not part of the offline core-only check. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createToolRegistry } from '../src/modules/index.js';
import { createServer } from '../src/server.js';
import { ProcessManager } from '../src/process.js';
import { McpLoader } from '../src/mcp/loader.js';
import type { ModuleContext } from '../src/modules/context.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const ORIGINAL_TOOLS = [
  'workspace_info', 'list_workspaces', 'list_directory', 'workspace_tree', 'stat_path', 'find_files',
  'search_files', 'read_file', 'read_file_lines', 'write_file', 'edit_file', 'apply_patch',
  'create_directory', 'delete_path', 'move_path', 'list_mcp_servers', 'list_mcp_tools', 'call_mcp_tool',
  'list_skills', 'read_skill', 'run_command', 'start_process', 'read_process', 'write_process',
  'stop_process', 'list_processes',
];
async function fixture(t: { after: (fn: () => Promise<unknown>) => void }): Promise<ModuleContext> {
  const root = await mkdtemp(join(tmpdir(), 'localmcp-module-integration-'));
  const processes = new ProcessManager(); const mcp = new McpLoader({}); await mcp.start();
  t.after(async () => { await processes.close(); await mcp.close(); await rm(root, { recursive: true, force: true }); });
  return {
    config: { root, workspaces: { test: root }, defaultWorkspace: 'test', files: true, fileRead: true, fileWrite: true, shell: true, processes: true, port: 8787, skillsDir: join(root, 'skills'), mcpServers: {} },
    processes, mcp, skills: [],
  };
}

test('module catalog retains all 26 original tools and adds only git_status', async t => {
  const context = await fixture(t); const registry = createToolRegistry();
  assert.deepEqual(registry.list(context).map(tool => tool.name), [...ORIGINAL_TOOLS, 'git_status']);
  context.config.shell = false;
  assert.equal(registry.list(context).length, 20);
  await assert.rejects(registry.call('git_status', {}, context));
});
test('file module validates real Zod schemas and retains write/read/edit behavior', async t => {
  const context = await fixture(t); const registry = createToolRegistry();
  await registry.call('write_file', { path: 'hello.txt', content: 'hello world' }, context);
  await registry.call('edit_file', { path: 'hello.txt', oldText: 'world', newText: 'MCP' }, context);
  assert.deepEqual((await registry.call('read_file', { path: 'hello.txt' }, context)).result, { path: 'hello.txt', content: 'hello MCP' });
  await assert.rejects(registry.call('read_file', { path: 3 }, context));
  await assert.rejects(registry.call('read_file', { path: '../outside' }, context));
  await assert.rejects(registry.call('workspace_info', { workspace: 3 }, context));
  context.config.files = false;
  await assert.rejects(registry.call('write_file', { path: 'denied.txt', content: 'x' }, context));
});
test('external MCP metadata remains conservative', async t => {
  const context = await fixture(t); const registry = createToolRegistry();
  const tool = registry.list(context).find(tool => tool.name === 'call_mcp_tool');
  assert.equal(tool?.annotations.readOnlyHint, false);
  assert.equal(tool?.annotations.openWorldHint, true);
  assert.deepEqual((await registry.call('list_mcp_servers', {}, context)).result, { servers: [] });
});
test('actual SDK client/server round trip uses the modular dispatcher', async t => {
  const context = await fixture(t);
  const server = await createServer(context.config, context.mcp, context.skills, context.processes);
  const client = new Client({ name: 'modular-integration', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const tools = await client.listTools(); assert.equal(tools.tools.length, 27);
  const write = await client.callTool({ name: 'write_file', arguments: { path: 'roundtrip.txt', content: 'from sdk' } });
  assert.notEqual(write.isError, true);
  const read = await client.callTool({ name: 'read_file', arguments: { path: 'roundtrip.txt' } });
  assert.deepEqual(read.content, [{ type: 'text', text: JSON.stringify({ path: 'roundtrip.txt', content: 'from sdk' }) }]);
  const invalid = await client.callTool({ name: 'read_file', arguments: { path: '../outside' } });
  assert.equal(invalid.isError, true);
});
