// Publishing (canonical workspace-backed path only)
export {
  publishWorkspaceDraft,
  createStagingRelease,
  getActiveVersion,
  type PublishWorkspaceOptions,
  type PublishResult,
} from './publish';

// Rollback
export {
  rollbackToVersion,
  getRollbackHistory,
  canRollbackTo,
  getAvailableRollbackVersions,
  rollbackToPrevious,
  type RollbackOptions,
  type RollbackResult,
} from './rollback';
