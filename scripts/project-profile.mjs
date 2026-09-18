#!/usr/bin/env node
import { initializeProfile, inspectProfile, createDemo, ProfileError } from './lib/project-profile.mjs';

const help = `Local-only profile preparation (does not launch LocalMCP or a tunnel)
  node scripts/project-profile.mjs init --workspace PATH --config FILE
  node scripts/project-profile.mjs demo --parent EXISTING_DIRECTORY --config FILE
  node scripts/project-profile.mjs doctor --config FILE
Existing profiles are never overwritten. doctor checks the generated files-only profile, not arbitrary configurations.`;
const [command, ...args] = process.argv.slice(2);
if (command === '--help' || command === 'help') console.log(help);
else {
  try {
    const allowed = { init: ['workspace', 'config'], demo: ['parent', 'config'], doctor: ['config'] }[command];
    if (!allowed) throw new ProfileError('USAGE', help);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].startsWith('--') ? args[i].slice(2) : '';
      if (!allowed.includes(key) || Object.hasOwn(options, key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new ProfileError('USAGE', help);
      options[key] = args[i + 1];
    }
    if (allowed.some(key => !options[key])) throw new ProfileError('USAGE', help);
    const action = { init: initializeProfile, demo: createDemo, doctor: inspectProfile }[command];
    console.log(JSON.stringify(await action(options), null, 2));
  } catch (error) {
    // Do not echo arbitrary JSON, environment values, or a raw exception stack.
    const known = error instanceof ProfileError;
    console.error(JSON.stringify({ status: 'blocked', code: known ? error.code : 'FILESYSTEM_ERROR', message: known ? error.message : 'Cannot access the requested local profile or directory.' }));
    process.exitCode = 1;
  }
}
