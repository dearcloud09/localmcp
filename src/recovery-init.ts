#!/usr/bin/env node
// Explicit local provisioning; no server, tunnel, package installation or old-record reset.
import { config } from './config.js';
import { initializeRecovery } from './core/mutation-runtime.js';

async function main(): Promise<void> {
  if (process.argv.slice(2).join('\0') !== '--create-only') throw new Error('Use: node dist/recovery-init.js --create-only');
  await initializeRecovery(await config());
  console.log('RECOVERY_INITIALIZED (new namespace only; no server started)');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'RECOVERY_INIT_FAILED'); process.exitCode = 1; });
