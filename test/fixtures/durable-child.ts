// Test-only process: all paths are supplied temporary fixtures. No server or network.
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { DurableMutationJournal } from '../../src/core/durable-mutation-journal.js';
import { mutationPath } from '../../src/core/mutation-coordinator.js';
const [directory, project, id, phase] = process.argv.slice(2);
const wait = () => new Promise<never>(() => { setInterval(() => {}, 1000); });
const report = (phase: string) => process.send?.({ phase });
try {
  const journal = await DurableMutationJournal.open({ directory, workspaceRoots: [project] });
  const result = await journal.run(mutationPath(project), id, 'b'.repeat(64), async () => {
    if (phase === 'before') { report('before'); await wait(); }
    const fd = await open(join(project, 'effects.txt'), 'a', 0o600);
    try { await fd.writeFile('effect\n'); await fd.sync(); } finally { await fd.close(); }
    if (phase === 'after') { report('after'); await wait(); }
    return { path: 'a.txt', bytes: 1, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) };
  });
  if (phase === 'committed') { report('committed'); await wait(); }
  console.log(JSON.stringify(result));
} catch (e) { console.error((e as { code?: string }).code ?? 'CHILD_FAILED'); process.exitCode = 2; }
