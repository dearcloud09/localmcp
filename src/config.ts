import { realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { McpServerConfig } from './mcp/loader.js';
import { readRuntimeDocument, resolveRuntimeWorkspaces, resolveExecutionFlags } from './core/runtime-policy.js';

const mcpEntrySchema = z.object({
  enabled: z.boolean().optional().default(true), command: z.string().min(1),
  args: z.array(z.string()).optional().default([]), env: z.record(z.string(), z.string()).optional(),
}).strict();
export const localMcpConfigSchema = z.object({
  root: z.string().min(1).optional(),
  workspaces: z.record(z.string().min(1), z.string().min(1)).optional(),
  defaultWorkspace: z.string().min(1).optional(),
  features: z.object({
    files: z.boolean().optional().default(true),
    shell: z.boolean().optional().default(false),
    processes: z.boolean().optional().default(false),
  }).strict().optional().default({ files: true, shell: false, processes: false }),
  skills: z.object({
    dir: z.string().optional().default('skills'), enabled: z.array(z.string().min(1)).optional().default([]),
  }).strict().optional().default({ dir: 'skills', enabled: [] }),
  mcpServers: z.record(z.string(), mcpEntrySchema).optional().default({}),
}).strict();
export interface Config {
  root: string; workspaces: Record<string, string>; defaultWorkspace: string;
  files: boolean; shell: boolean; processes: boolean; port: number; token?: string;
  skillsDir: string; enabledSkills?: string[]; mcpServers: Record<string, McpServerConfig>; configFile?: string;
}
export function configFilePath(): string {
  return resolve(process.env.LOCALMCP_CONFIG || resolve(homedir(), '.localmcp', 'localmcp.json'));
}
export async function config(snapshot?: { content: string; path: string }): Promise<Config> {
  const requestedPath = snapshot?.path ?? configFilePath();
  const raw = await readRuntimeDocument(requestedPath, snapshot?.content);
  const parsed = localMcpConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map(i => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
    throw new Error(`Invalid LocalMCP config: ${details}`);
  }
  const c = parsed.data;
  const path = await realpath(requestedPath);
  // Used by initial startup and both hot/manual reload. Never fall back to home.
  const workspaces = await resolveRuntimeWorkspaces(c, path);
  const execution = resolveExecutionFlags(c.features);
  const port = Number(process.env.LOCALMCP_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid LOCALMCP_PORT');
  const mcpServers: Record<string, McpServerConfig> = {};
  for (const [name, m] of Object.entries(c.mcpServers)) {
    if (m.enabled) mcpServers[name] = { command: m.command, args: m.args, env: m.env };
  }
  return {
    ...workspaces, files: c.features.files, ...execution, port, token: process.env.LOCALMCP_TOKEN,
    skillsDir: resolve(dirname(path), c.skills.dir), enabledSkills: c.skills.enabled,
    mcpServers, configFile: path,
  };
}
