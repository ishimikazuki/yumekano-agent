/**
 * Rollback utilities for reverting to previous versions.
 *
 * Rollback is done by pointer switch, not destructive edits.
 * The old version remains intact and can be re-activated.
 */

import { characterRepo, releaseRepo } from '../repositories';
import type { Release, CharacterVersion } from '../schemas';

export interface RollbackOptions {
  characterId: string;
  targetVersionId: string;
  publishedBy: string;
}

export interface RollbackResult {
  previousReleaseId: string;
  newReleaseId: string;
  rolledBackFromVersion: number;
  rolledBackToVersion: number;
}

/**
 * Rollback to a previous version.
 * Creates a new release pointing to the target version.
 */
export async function rollbackToVersion(options: RollbackOptions): Promise<RollbackResult> {
  const { characterId, targetVersionId, publishedBy } = options;

  // Get the target version
  const targetVersion = await characterRepo.getVersionById(targetVersionId);
  if (!targetVersion) {
    throw new Error(`Target version ${targetVersionId} not found`);
  }

  if (targetVersion.characterId !== characterId) {
    throw new Error('Target version does not belong to this character');
  }

  // Get current active release
  const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');

  if (!currentRelease) {
    throw new Error('No active production release found');
  }

  // Get current version for comparison
  const currentVersion = await characterRepo.getVersionById(currentRelease.characterVersionId);
  if (!currentVersion) {
    throw new Error('Current version not found');
  }

  // Create new release pointing to target version (rollback)
  const newRelease = await releaseRepo.createRollback({
    characterId,
    characterVersionId: targetVersionId,
    publishedBy,
    rollbackOfReleaseId: currentRelease.id,
  });

  return {
    previousReleaseId: currentRelease.id,
    newReleaseId: newRelease.id,
    rolledBackFromVersion: currentVersion.versionNumber,
    rolledBackToVersion: targetVersion.versionNumber,
  };
}

/**
 * Get rollback history for a character.
 */
export async function getRollbackHistory(characterId: string): Promise<Array<{
  releaseId: string;
  versionNumber: number;
  publishedAt: Date;
  wasRollback: boolean;
}>> {
  const releases = await releaseRepo.listByCharacter(characterId);
  const history: Array<{
    releaseId: string;
    versionNumber: number;
    publishedAt: Date;
    wasRollback: boolean;
  }> = [];

  for (const release of releases) {
    const version = await characterRepo.getVersionById(release.characterVersionId);
    if (version) {
      history.push({
        releaseId: release.id,
        versionNumber: version.versionNumber,
        publishedAt: release.publishedAt,
        wasRollback: release.rollbackOfReleaseId !== null,
      });
    }
  }

  return history;
}

/**
 * Check if a version can be rolled back to.
 */
export async function canRollbackTo(
  characterId: string,
  targetVersionId: string
): Promise<{ canRollback: boolean; reason?: string }> {
  const targetVersion = await characterRepo.getVersionById(targetVersionId);

  if (!targetVersion) {
    return { canRollback: false, reason: 'Version not found' };
  }

  if (targetVersion.characterId !== characterId) {
    return { canRollback: false, reason: 'Version belongs to different character' };
  }

  return { canRollback: true };
}

/**
 * Get all versions available for rollback.
 */
export async function getAvailableRollbackVersions(
  characterId: string,
  excludeCurrentVersion = true
): Promise<CharacterVersion[]> {
  const versions = await characterRepo.listVersions(characterId);

  if (!excludeCurrentVersion) {
    return versions;
  }

  // Get current active release
  const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');

  if (!currentRelease) {
    return versions;
  }

  return versions.filter((v: CharacterVersion) => v.id !== currentRelease.characterVersionId);
}

/**
 * Quick rollback to the previous version.
 */
export async function rollbackToPrevious(input: {
  characterId: string;
  publishedBy: string;
}): Promise<RollbackResult> {
  const { characterId, publishedBy } = input;

  // Get current release
  const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');

  if (!currentRelease) {
    throw new Error('No active production release found');
  }

  // Get previous release
  const previousRelease = await releaseRepo.getPrevious(characterId, currentRelease.id, 'prod');

  if (!previousRelease) {
    throw new Error('No previous release available for rollback');
  }

  return rollbackToVersion({
    characterId,
    targetVersionId: previousRelease.characterVersionId,
    publishedBy,
  });
}
