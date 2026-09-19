#!/usr/bin/env node
// Real installed SDK + freshly built server. This is NOT a live ChatGPT test.
import assert from 'node:assert/strict';
import { rm, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeFixture, setProfile, RED_SOURCE, GREEN_SOURCE, TEST_SOURCE, digest, assertSourceOnlyChange } from './lib/minimum-fixture.mjs';
import { isolatedEnvironment, runProcess } from './lib/verification.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let fixture;
try {
  // Fail rather than substituting a mock protocol client when dependencies are absent.
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  fixture = await makeFixture(); const f = fixture, env = isolatedEnvironment(f.home);
  const beforeNames = (await readdir(f.project)).sort();
  const tests = () => runProcess(process.execPath, ['--test', 'calculator.test.mjs'], { cwd: f.project, env, timeoutMs: 10000 });
  const red = await tests(); assert.equal(red.exitCode, 1); assert.match(red.stdout, /fail 3\b/);
  const withServer = async (writable, action) => {
    await setProfile(f, writable);
    const client = new Client({ name: 'localmcp-minimum', version: '1' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'dist/index.js'), 'stdio'],
      env: { ...env, LOCALMCP_CONFIG: f.config }, stderr: 'pipe' });
    transport.stderr?.on('data', () => {});
    try { await client.connect(transport); await action(client); } finally { await client.close(); }
  };
  const call = (client, name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 10000 });
  const readText = result => JSON.parse(result.content.find(c => c.type === 'text').text).content;
  await withServer(false, async client => {
    const tools = await client.listTools(); const names = tools.tools.map(t => t.name);
    assert.ok(names.includes('read_file'));
    for (const name of ['write_file', 'edit_file', 'apply_patch', 'run_command', 'start_process', 'run_check']) assert.ok(!names.includes(name), `Unexpected tool: ${name}`);
    assert.equal(readText(await call(client, 'read_file', { path: 'calculator.mjs' })), RED_SOURCE);
    assert.equal((await call(client, 'write_file', { path: 'calculator.mjs', content: GREEN_SOURCE, overwrite: true })).isError, true);
    const denied = await call(client, 'read_file', { path: '.env' }); assert.equal(denied.isError, true);
    assert.ok(!JSON.stringify(denied).includes('NOT_A_REAL_CREDENTIAL'));
    const listed = JSON.stringify(await call(client, 'workspace_tree', { path: '.' })); assert.ok(!listed.includes('.env'));
    assert.equal(await readFile(join(f.project, 'calculator.mjs'), 'utf8'), RED_SOURCE);
  });
  await withServer(true, async client => {
    const initial = await call(client, 'read_file', { path: 'calculator.mjs' }); assert.equal(readText(initial), RED_SOURCE);
    assert.equal(readText(await call(client, 'read_file', { path: 'calculator.test.mjs' })), TEST_SOURCE);
    const edit = await call(client, 'edit_file', { path: 'calculator.mjs', oldText: 'return a - b', newText: 'return a + b' }); assert.notEqual(edit.isError, true);
    assert.equal(readText(await call(client, 'read_file', { path: 'calculator.mjs' })), GREEN_SOURCE);
    const stale = await call(client, 'apply_patch', { path: 'calculator.mjs', expectedSha256: digest(RED_SOURCE), edits: [{ startLine: 1, endLine: 1, replacement: RED_SOURCE.trim() }] });
    assert.equal(stale.isError, true); await assertSourceOnlyChange(f);
    assert.equal((await call(client, 'run_command', { command: 'pwd' })).isError, true);
  });
  const green = await tests(); assert.equal(green.exitCode, 0); assert.equal(green.reason, null); assert.match(green.stdout, /pass 3\b/);
  await assertSourceOnlyChange(f); assert.deepEqual((await readdir(f.project)).sort(), beforeNames);
  console.log(JSON.stringify({ status: 'passed', transport: 'real-sdk-stdio', before: { fail: 3 }, after: { pass: 3 },
    changedFiles: ['calculator.mjs'], testFileUnchanged: true, protectedFileUnchanged: true, stalePatchRejected: true,
    shellDisabled: true, liveChatGPTTested: false }));
} catch (error) { console.error('MCP_SMOKE_FAILED:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; }
finally { if (fixture) await rm(fixture.base, { recursive: true, force: true }); }
