#!/usr/bin/env node
// Real Docker and actual MCP calls required. No mocked-success path and no image download.
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { makeFixture, setProfile, assertSourceOnlyChange } from './lib/minimum-fixture.mjs';
import { isolatedEnvironment } from './lib/verification.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url))), image = process.argv[2];
let f, client;
try {
  assert.match(image ?? '', /^sha256:[a-f0-9]{64}$/, 'Supply an already installed, reviewed Linux Node image ID.');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  f = await makeFixture();
  const hostOnly = join(f.home, 'host-only-marker'); await writeFile(hostOnly, 'FAKE_HOST_ONLY');
  const probe = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
test('nonroot and no-new-privileges',()=>{assert.notEqual(process.getuid(),0);const s=fs.readFileSync('/proc/self/status','utf8');assert.match(s,/NoNewPrivs:\\s+1/);assert.match(s,/CapEff:\\s+0+\\b/);});
test('host and secret paths absent',()=>{for(const p of ['.env','/var/run/docker.sock',${JSON.stringify(hostOnly)}])assert.equal(fs.existsSync(p),false,p);assert.equal(process.env.LOCALMCP_TOKEN,undefined);});
test('no nonloopback interfaces',()=>{for(const rows of Object.values(os.networkInterfaces()))for(const a of rows??[])assert.equal(a.internal,true);});
test('root filesystem not writable',()=>{assert.throws(()=>fs.writeFileSync('/rootfs-probe','x'));});
test('scratch writes allowed',()=>{fs.writeFileSync('snapshot-only.txt','temporary');assert.equal(fs.readFileSync('snapshot-only.txt','utf8'),'temporary');});
`;
  await writeFile(join(f.project, 'sandbox.test.mjs'), probe);
  await setProfile(f, true, {
    test: { image, executable: '/usr/local/bin/node', args: ['--test', 'calculator.test.mjs', 'sandbox.test.mjs'], timeoutMs: 30000 },
    timeout: { image, executable: '/usr/local/bin/node', args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 300 },
  });
  // Host HOME is needed only by the trusted Docker CLI to locate its local context;
  // it is not mounted or copied into the test container.
  const env = { ...isolatedEnvironment(f.home), HOME: homedir(), USERPROFILE: homedir(), LOCALMCP_CONFIG: f.config, LOCALMCP_TOKEN: 'FAKE_HOST_TOKEN_NOT_FOR_CONTAINER' };
  client = new Client({ name: 'sandbox-minimum', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'dist/index.js'), 'stdio'], env, stderr: 'pipe' });
  transport.stderr?.on('data', () => {}); await client.connect(transport);
  const call = (name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  const check = async name => {
    const r = await call('run_check', { check: name }); assert.notEqual(r.isError, true, JSON.stringify(r.content));
    return JSON.parse(r.content.find(c => c.type === 'text').text);
  };
  const red = await check('test'); assert.equal(red.exitCode, 1); assert.match(red.stdout, /fail 3\b/); assert.equal(red.cleanupConfirmed, true);
  assert.equal((await call('edit_file', { path: 'calculator.mjs', oldText: 'return a - b', newText: 'return a + b' })).isError, undefined);
  const green = await check('test'); assert.equal(green.exitCode, 0); assert.match(green.stdout, /pass 8\b/); assert.equal(green.cleanupConfirmed, true);
  const timeout = await check('timeout'); assert.equal(timeout.timedOut, true); assert.equal(timeout.cleanupConfirmed, true);
  await assertSourceOnlyChange(f); await assert.rejects(access(join(f.project, 'snapshot-only.txt')));
  assert.equal(await readFile(join(f.project, 'sandbox.test.mjs'), 'utf8'), probe);
  console.log(JSON.stringify({ status: 'passed', transport: 'real-sdk-stdio', dockerImage: image,
    beforeFailed: 3, afterPassed: 8, timeoutCleanupConfirmed: true, originalTestsUnchanged: true,
    hostProjectNotMounted: true, writeback: false, liveChatGPTTested: false }));
} catch (error) { console.error('SANDBOX_SMOKE_FAILED:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; }
finally { await client?.close(); if (f) await rm(f.base, { recursive: true, force: true }); }
