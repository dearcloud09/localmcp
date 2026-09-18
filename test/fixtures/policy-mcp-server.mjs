// Test-only SDK server. Inputs and call log are files created by the test harness.
import { readFile, appendFile } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
const [catalog, log] = process.argv.slice(2);
if (!catalog || !log) throw new Error('Fixture requires a catalog and call log');
const server = new Server({ name: 'localmcp-policy-fixture', version: '1' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: JSON.parse(await readFile(catalog, 'utf8')) }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  await appendFile(log, request.params.name + '\n');
  return { content: [{ type: 'text', text: 'ok' }] };
});
await server.connect(new StdioServerTransport());
