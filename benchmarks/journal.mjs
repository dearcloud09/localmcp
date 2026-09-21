#!/usr/bin/env node
// Developer microbenchmark. No MCP, network, shell commands or user workspaces.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { Workspace } from '../compiled/src/workspace.js';
import { MutationJournal } from '../compiled/src/core/mutation-coordinator.js';
import { DurableMutationJournal } from '../compiled/src/core/durable-mutation-journal.js';
const n = Number(process.argv[2] ?? 100);
if (!Number.isSafeInteger(n) || n < 20 || n > 400) throw new Error('Use 20..400 samples');
const base = await realpath(await mkdtemp(join(tmpdir(), 'localmcp-journal-benchmark-')));
const hash = text => createHash('sha256').update(text).digest('hex');
const before = 'a'.repeat(4096), after = 'b' + before.slice(1), fingerprint = hash(before);
const summary = values => {
  const a = [...values].sort((x, y) => x - y), q = p => a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)];
  return { n: a.length, p50Ms: q(.5), p95Ms: q(.95), minMs: a[0], maxMs: a.at(-1), meanMs: a.reduce((x, y) => x + y, 0) / a.length };
};
try {
  const projects = { memory: join(base, 'memory'), durable: join(base, 'durable') };
  for (const p of Object.values(projects)) await mkdir(p, { mode: 0o700 });
  const journal = await DurableMutationJournal.open({ directory: join(base, 'journal'), workspaceRoots: [projects.durable] });
  const workspaces = { memory: new Workspace(projects.memory, new MutationJournal()), durable: new Workspace(projects.durable, journal) };
  const timings = { memory: [], durable: [], replay: [] };
  const warmup = 10;
  for (let i = 0; i < n + warmup; i++) {
    const file = `sample-${i}.txt`, options = { expectedSha256: fingerprint, operationId: `benchmark-${i}` };
    for (const p of Object.values(projects)) await writeFile(join(p, file), before, { mode: 0o600 });
    // Alternate ordering to reduce systematic cache/warmup order bias.
    for (const kind of i % 2 ? ['durable', 'memory'] : ['memory', 'durable']) {
      const start = performance.now();
      const result = await workspaces[kind].editText(file, before, after, options);
      const ms = performance.now() - start;
      assert.equal(result.afterSha256, hash(after)); assert.equal(result.replayed, false);
      if (i >= warmup) timings[kind].push(ms);
    }
    const start = performance.now();
    const replay = await workspaces.durable.editText(file, before, after, options);
    const ms = performance.now() - start;
    assert.equal(replay.replayed, true); if (i >= warmup) timings.replay.push(ms);
  }
  console.log(JSON.stringify({ scope: 'single-process local 4096-byte guarded Workspace edit; not MCP or end-to-end',
    environment: { node: process.version, platform: process.platform, uid: process.getuid?.(), arch: process.arch,
      cpu: cpus()[0]?.model, filesystemType: String((await statfs(base)).type) },
    samplesPerMode: n, warmupPerMode: warmup,
    measurement: 'editText call only; preparation and post-check assertions outside timed section; alternating paired order',
    memory: summary(timings.memory), durable: summary(timings.durable), successfulReplay: summary(timings.replay),
    rawMs: timings,
    limits: ['One container filesystem, not user Mac or SSD power-failure testing.',
      'No model, MCP, Worker, Docker, transport or multi-process latency measured.',
      'A receipt replay is a different operation from a fresh edit; do not compare it as an edit speedup.',
      'Do not generalize microbenchmark ratios to total coding task duration.'] }, null, 2));
} finally { await rm(base, { recursive: true, force: true }); }
