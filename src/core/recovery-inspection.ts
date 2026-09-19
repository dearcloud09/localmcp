import { realpath } from 'node:fs/promises';
import { DurableMutationJournal, summarizeRecoveryState, type JournalInventory, type RecoverySummary } from './durable-mutation-journal.js';
import { mutationPath } from './mutation-coordinator.js';
import { Workspace } from '../workspace.js';

export interface InspectionOptions {
  directory: string; workspaceRoots: string[]; capacity?: number;
  limit?: number; after?: string; operationId?: string; scope?: string; compareCurrent?: boolean;
}
export interface OperationInspection extends RecoverySummary {
  currentFile: 'not_requested' | 'not_applicable' | 'matches_recorded_after' | 'differs_from_recorded_after' | 'unavailable';
  currentFileProvesActorOrExactlyOnce: false;
}
export interface InspectionReport {
  status: 'inspection_completed' | 'operator_review_required';
  inventory: JournalInventory;
  operation?: OperationInspection;
  assessmentScope: 'returned_page_and_optional_operation'; wholeJournalHealthAsserted: false;
  recordsChanged: false; locksRemoved: false; actionsExecuted: false; networkStarted: false;
}

/** No config evaluation, app startup, subprocess, automatic reset or execution. */
export async function inspectRecovery(options: InspectionOptions): Promise<InspectionReport> {
  if ((options.operationId === undefined) !== (options.scope === undefined) ||
      (options.compareCurrent && options.operationId === undefined)) throw new Error('INSPECTION_OPERATION_SCOPE_REQUIRED');
  const journal = await DurableMutationJournal.open({ directory: options.directory, workspaceRoots: options.workspaceRoots,
    capacity: options.capacity, openMode: 'existing-only' });
  const inventory = await journal.inventory({ limit: options.limit, after: options.after });
  let operation: OperationInspection | undefined;
  if (options.operationId !== undefined) {
    const workspace = await realpath(options.scope!);
    const scope = mutationPath(workspace);
    const state = await journal.inspect(scope, options.operationId);
    operation = { ...summarizeRecoveryState(state), currentFile: options.compareCurrent ? 'not_applicable' : 'not_requested',
      currentFileProvesActorOrExactlyOnce: false };
    if (options.compareCurrent && state.state === 'succeeded') {
      try {
        // Existing Workspace path/link/size policy applies. Do not execute or print file contents.
        const current = await new Workspace(workspace).readVersion(state.receipt.path);
        operation.currentFile = current.sha256 === state.receipt.afterSha256 ? 'matches_recorded_after' : 'differs_from_recorded_after';
      } catch { operation.currentFile = 'unavailable'; }
    }
  }
  const needsReview = inventory.allocationLock === 'observed_present' || inventory.nextCursor !== null ||
    inventory.capacityRemainingObserved === 0 || inventory.records.some(r => r.state !== 'succeeded') ||
    (operation !== undefined && (operation.state !== 'succeeded' || ['differs_from_recorded_after', 'unavailable'].includes(operation.currentFile)));
  return { status: needsReview ? 'operator_review_required' : 'inspection_completed', inventory,
    ...(operation ? { operation } : {}), assessmentScope: 'returned_page_and_optional_operation', wholeJournalHealthAsserted: false, recordsChanged: false, locksRemoved: false, actionsExecuted: false, networkStarted: false };
}
