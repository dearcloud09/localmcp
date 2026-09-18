import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, realpath, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

// Local preparation only: no server, tunnel, process execution, or credential creation.
export class ProfileError extends Error {
  constructor(code, message) { super(message); this.name = 'ProfileError'; this.code = code; }
}
const fail = (code, message) => { throw new ProfileError(code, message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function within(child, parent) {
  const part = relative(parent, child);
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
}
function inputPath(value, home) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) fail('PATH_REQUIRED', 'An explicit nonempty path is required.');
  if (value === '~') return home;
  return value.startsWith('~/') ? resolve(home, value.slice(2)) : resolve(value);
}
async function canonicalFuture(path) {
  const suffix = []; let current = path;
  for (;;) {
    try { return resolve(await realpath(current), ...suffix); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // A dangling link is not a missing directory to create.
      try { if ((await lstat(current)).isSymbolicLink()) fail('DANGLING_LINK', 'A path contains a dangling symbolic link.'); }
      catch (inner) { if (inner.code !== 'ENOENT') throw inner; }
      const parent = dirname(current);
      if (parent === current) throw error;
      suffix.unshift(basename(current)); current = parent;
    }
  }
}
export async function projectRoot(value, { home = homedir() } = {}) {
  const homeRoot = await realpath(home);
  let root;
  try { root = await realpath(inputPath(value, homeRoot)); }
  catch (error) { if (error instanceof ProfileError) throw error; fail('WORKSPACE_MISSING', 'The workspace must be an existing directory.'); }
  if (!(await stat(root)).isDirectory()) fail('WORKSPACE_NOT_DIRECTORY', 'The workspace must be a directory.');
  if (root === parse(root).root || within(homeRoot, root)) fail('WORKSPACE_TOO_BROAD', 'Do not expose the filesystem root, home directory, or an ancestor of home.');
  for (const name of ['.localmcp', '.ssh', '.aws', '.gnupg', '.kube']) {
    const protectedRoot = await canonicalFuture(join(homeRoot, name));
    if (within(root, protectedRoot) || within(protectedRoot, root)) fail('PROTECTED_WORKSPACE', 'The workspace overlaps a runtime or credential directory.');
  }
  return root;
}
async function profilePath(value, root, home) {
  const requested = inputPath(value, home);
  const actual = await canonicalFuture(requested);
  if (within(requested, root) || within(actual, root)) fail('CONFIG_IN_WORKSPACE', 'Store the profile outside the model-writable workspace.');
  return requested;
}
async function mustNotExist(path) {
  try { await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  fail('CONFIG_EXISTS', 'The profile already exists; no existing file was replaced.');
}
export function safeProfile(root) {
  return {
    workspaces: { project: root }, defaultWorkspace: 'project',
    features: { files: true, shell: false, processes: false },
    // Explicitly an editable smoke profile, not the runtime's read-only default.
    permissions: { fileRead: true, fileWrite: true },
    skills: { dir: 'skills', enabled: [] }, mcpServers: {},
  };
}
export async function initializeProfile({ workspace, config, home = homedir() }) {
  const root = await projectRoot(workspace, { home });
  const target = await profilePath(config, root, home);
  await mustNotExist(target);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  // Recheck the resolved parent after creation; not a hostile-local-user sandbox.
  await profilePath(target, root, home);
  let file;
  try { file = await open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
  catch (error) { if (error.code === 'EEXIST') fail('CONFIG_EXISTS', 'The profile already exists; no existing file was replaced.'); throw error; }
  try { await file.writeFile(JSON.stringify(safeProfile(root), null, 2) + '\n', 'utf8'); await file.sync(); }
  finally { await file.close(); }
  return { status: 'created', config: target, workspace: root, shell: false, processes: false, serversStarted: false };
}
function keysAre(value, expected) {
  return object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function checkShape(value) {
  // Deliberately validate only this tool's files-only smoke profile, not every LocalMCP configuration.
  if (!keysAre(value, ['workspaces', 'defaultWorkspace', 'features', 'permissions', 'skills', 'mcpServers']) ||
      !keysAre(value.workspaces, ['project']) || typeof value.workspaces.project !== 'string' || value.defaultWorkspace !== 'project' ||
      !keysAre(value.features, ['files', 'shell', 'processes']) || value.features.files !== true ||
      value.features.shell !== false || value.features.processes !== false ||
      !keysAre(value.permissions, ['fileRead', 'fileWrite']) || value.permissions.fileRead !== true || value.permissions.fileWrite !== true ||
      !keysAre(value.skills, ['dir', 'enabled']) || value.skills.dir !== 'skills' ||
      !Array.isArray(value.skills.enabled) || value.skills.enabled.length !== 0 ||
      !object(value.mcpServers) || Object.keys(value.mcpServers).length !== 0) {
    fail('NOT_SMOKE_PROFILE', 'Expected the editable smoke profile with explicit fileRead/fileWrite permission and execution disabled. Review old profiles before regenerating.');
  }
}
export async function inspectProfile({ config, home = homedir(), env = process.env }) {
  const target = inputPath(config, home);
  const metadata = await lstat(target);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) fail('CONFIG_NOT_REGULAR', 'The profile must be a regular file with one hard link.');
  const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > 65536) fail('CONFIG_SIZE_OR_TYPE', 'Invalid profile type or size (maximum 64 KiB).');
    if (process.platform !== 'win32' && (info.mode & 0o077) !== 0) fail('CONFIG_PERMISSIONS', 'The profile must not be readable or writable by group/others.');
    bytes = await file.readFile();
    if (bytes.length > 65536) fail('CONFIG_SIZE_OR_TYPE', 'The profile grew beyond its size limit.');
  } finally { await file.close(); }
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch { fail('CONFIG_JSON', 'The profile is not valid JSON. Its contents have not been printed.'); }
  checkShape(value);
  if (!isAbsolute(value.workspaces.project)) fail('RELATIVE_WORKSPACE', 'The generated profile requires an absolute workspace path.');
  const root = await projectRoot(value.workspaces.project, { home });
  await profilePath(target, root, home);
  if (env.LOCALMCP_ROOT !== undefined || (env.LOCALMCP_SHELL !== undefined && env.LOCALMCP_SHELL !== '0')) {
    fail('ENV_OVERRIDE', 'Unset LOCALMCP_ROOT and any shell-enabling override before using this profile.');
  }
  if (env.LOCALMCP_CONFIG !== undefined && await canonicalFuture(inputPath(env.LOCALMCP_CONFIG, home)) !== await realpath(target)) {
    fail('CONFIG_OVERRIDE', 'LOCALMCP_CONFIG points to another profile.');
  }
  return {
    status: 'profile-check-passed', config: target, workspace: root,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    capabilities: { fileWrites: true, shell: false, processes: false, externalMcp: false, skills: false },
    limitations: ['Local preflight only; no ChatGPT, tunnel, or MCP connection was tested.',
      'Files inside the workspace are writable and not automatically secret-filtered.',
      'Preflight does not enforce runtime policy, revoke active operations, or provide an OS sandbox.'],
  };
}
export const DEMO_FILES = Object.freeze({
  'calculator.mjs': 'export function add(a, b) { return a - b; }\n',
  'calculator.test.mjs': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from './calculator.mjs';\ntest('adds positive numbers', () => assert.equal(add(2, 3), 5));\ntest('adds negative numbers', () => assert.equal(add(-2, -3), -5));\ntest('adds zero', () => assert.equal(add(0, 4), 4));\n",
  'README.md': '# LocalMCP files-only smoke test\n\nThere is one intentional bug in calculator.mjs. Ask ChatGPT to read the source and test, edit only calculator.mjs, then read it back. Do not change tests or enable command execution. Run `node --test calculator.test.mjs` yourself before and after. This fixture contains no secrets and is not a sandbox.\n',
});
export async function createDemo({ parent, config, home = homedir() }) {
  const parentRoot = await projectRoot(parent, { home });
  // Validate path and existence before creating anything. Store the profile outside the entire parent to avoid overlap.
  await profilePath(config, parentRoot, home); await mustNotExist(inputPath(config, home));
  const workspace = await mkdtemp(join(parentRoot, 'localmcp-smoke-'));
  // Leave the new, reported directory for inspection on failure; never delete user paths recursively.
  try {
    for (const [name, text] of Object.entries(DEMO_FILES)) await writeFile(join(workspace, name), text, { mode: 0o600, flag: 'wx' });
    return { ...await initializeProfile({ workspace, config, home }), demoFiles: Object.keys(DEMO_FILES), intentionalFailingTests: 3 };
  } catch (error) { throw new ProfileError(error.code || 'DEMO_FAILED', `Demo preparation did not finish; inspect the newly created directory: ${workspace}`); }
}
