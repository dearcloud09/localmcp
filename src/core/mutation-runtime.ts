import { DurableMutationJournal } from './durable-mutation-journal.js';
import { fileMutationJournal, type MutationJournalBackend } from './mutation-coordinator.js';
import { parseRecoveryConfig, recoveryIdentity, resolveRecoveryConfig, RecoveryConfigError, type RecoveryHostConfig } from './recovery-config.js';
import { Workspace } from '../workspace.js';

/** Owned by one runtime, shared by its stateless HTTP servers and config snapshots. */
export class RuntimeMutations {
  private constructor(private readonly journal: MutationJournalBackend, private readonly identity: string,
    private readonly mode: 'memory' | 'durable') {}

  static async open(config: RecoveryHostConfig): Promise<RuntimeMutations> {
    const recovery = await resolveRecoveryConfig(config.recovery, config.workspaces, config.configFile);
    const normalized = { ...config, recovery };
    const journal = recovery.mode === 'durable'
      ? await DurableMutationJournal.open({ ...recovery, workspaceRoots: Object.values(config.workspaces), openMode: 'existing-only' })
      : fileMutationJournal;
    return new RuntimeMutations(journal, recoveryIdentity(normalized), recovery.mode);
  }
  assertCompatible(config: RecoveryHostConfig): void {
    if (recoveryIdentity(config) !== this.identity) throw new RecoveryConfigError('RECOVERY_RESTART_REQUIRED');
  }
  workspace(config: RecoveryHostConfig, requested?: string): { name: string; ws: Workspace } {
    this.assertCompatible(config);
    const name = requested ?? config.defaultWorkspace;
    if (!Object.prototype.hasOwnProperty.call(config.workspaces, name)) throw new Error(`Unknown workspace '${name}'`);
    return { name, ws: new Workspace(config.workspaces[name], this.journal) };
  }
  describe() {
    // No directory, workspace paths, operation IDs, hashes or receipt contents.
    return { mode: this.mode, scope: 'edit_file/apply_patch with operationId and expectedSha256',
      restartPersistent: this.mode === 'durable', automaticRetry: false, atomicFileAndJournal: false } as const;
  }
}

/** Explicit operator action only. Startup/reload never creates a new namespace. */
export async function initializeRecovery(config: RecoveryHostConfig): Promise<void> {
  const recovery = await resolveRecoveryConfig(config.recovery, config.workspaces, config.configFile);
  if (recovery.mode !== 'durable') throw new RecoveryConfigError('RECOVERY_DURABLE_REQUIRED');
  await DurableMutationJournal.open({ ...recovery, workspaceRoots: Object.values(config.workspaces), openMode: 'create-only' });
}

export interface MutationSnapshot { config: RecoveryHostConfig; mutations?: RuntimeMutations }
export function bindMutationSnapshot<T extends MutationSnapshot>(snapshot: T, mutations: RuntimeMutations): T & { mutations: RuntimeMutations } {
  if (snapshot.mutations !== undefined && snapshot.mutations !== mutations) throw new RecoveryConfigError('RECOVERY_RUNTIME_REPLACED');
  mutations.assertCompatible(snapshot.config);
  return { ...snapshot, mutations };
}

export function selectFileWorkspace(context: MutationSnapshot, requested?: string): { name: string; ws: Workspace } {
  if (context.mutations) return context.mutations.workspace(context.config, requested);
  // Preserve legacy direct embedding, but a durable config cannot silently use memory.
  if (parseRecoveryConfig(context.config.recovery).mode !== 'memory') throw new RecoveryConfigError('RECOVERY_RUNTIME_REQUIRED');
  const name = requested ?? context.config.defaultWorkspace;
  if (!Object.prototype.hasOwnProperty.call(context.config.workspaces, name)) throw new Error(`Unknown workspace '${name}'`);
  return { name, ws: new Workspace(context.config.workspaces[name]) };
}
