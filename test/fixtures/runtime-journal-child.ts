import { readFile } from 'node:fs/promises';
import { RuntimeMutations } from '../../src/core/mutation-runtime.js';
import type { RecoveryHostConfig } from '../../src/core/recovery-config.js';
import type { EditOptions } from '../../src/workspace.js';
const { config, opts } = JSON.parse(await readFile(process.argv[2], 'utf8')) as { config: RecoveryHostConfig; opts: EditOptions };
const runtime = await RuntimeMutations.open(config);
console.log(JSON.stringify(await runtime.workspace(config).ws.editText('a.ts', 'value = 1', 'value = 2', opts)));
