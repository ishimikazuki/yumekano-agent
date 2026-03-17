/**
 * Publish utilities for creating immutable releases.
 *
 * Publishing creates a new version from a draft and optionally activates it.
 */

import { characterRepo, releaseRepo } from '../repositories';
import { getDraft, deleteDraft, type DraftVersion } from './drafts';
import type { CharacterVersion, Release } from '../schemas';

export interface PublishOptions {
  draftId: string;
  publishedBy: string;
  activateImmediately?: boolean;
}

export interface PublishResult {
  versionId: string;
  releaseId?: string;
  versionNumber: number;
  publishedAt?: Date;
}

/**
 * Publish a draft as a new immutable version.
 */
export async function publishDraft(options: PublishOptions): Promise<PublishResult> {
  const { draftId, publishedBy, activateImmediately = false } = options;

  // Get the draft
  const draft = getDraft(draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  // Validate draft data
  validateDraftForPublish(draft);

  // Create the new version
  const newVersion = await characterRepo.createVersion({
    characterId: draft.characterId,
    persona: draft.data.persona,
    style: draft.data.style,
    autonomy: draft.data.autonomy,
    emotion: draft.data.emotion,
    memory: draft.data.memory,
    phaseGraphVersionId: draft.data.phaseGraphVersionId,
    promptBundleVersionId: draft.data.promptBundleVersionId,
    createdBy: publishedBy,
    status: activateImmediately ? 'published' : 'draft',
  });

  const result: PublishResult = {
    versionId: newVersion.id,
    versionNumber: newVersion.versionNumber,
  };

  // Create release record and activate
  if (activateImmediately) {
    const release = await releaseRepo.create({
      characterId: draft.characterId,
      characterVersionId: newVersion.id,
      channel: 'prod',
      publishedBy,
    });

    result.releaseId = release.id;
    result.publishedAt = release.publishedAt;
  }

  // Delete the draft after successful publish
  deleteDraft(draftId);

  return result;
}

/**
 * Validate that a draft has all required data for publishing.
 */
function validateDraftForPublish(draft: DraftVersion): void {
  const { data } = draft;
  const errors: string[] = [];

  // Persona validation
  if (!data.persona.summary || data.persona.summary.trim() === '') {
    errors.push('Character summary is required');
  }

  // Phase graph validation
  if (!data.phaseGraphVersionId) {
    errors.push('Phase graph is required');
  }

  // Prompt bundle validation
  if (!data.promptBundleVersionId) {
    errors.push('Prompt bundle is required');
  }

  // Emotion validation
  const pad = data.emotion.baselinePAD;
  if (pad.pleasure < -1 || pad.pleasure > 1 ||
      pad.arousal < -1 || pad.arousal > 1 ||
      pad.dominance < -1 || pad.dominance > 1) {
    errors.push('PAD values must be between -1 and 1');
  }

  if (errors.length > 0) {
    throw new Error(`Draft validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Create a staging release for testing before production.
 */
export async function createStagingRelease(input: {
  characterId: string;
  characterVersionId: string;
  publishedBy: string;
}): Promise<Release> {
  // Note: Current schema only supports 'prod' channel
  // For staging, we'd use draft status
  return releaseRepo.create({
    characterId: input.characterId,
    characterVersionId: input.characterVersionId,
    channel: 'prod', // Would be 'staging' if supported
    publishedBy: input.publishedBy,
  });
}

/**
 * Get the current active version for a channel.
 */
export async function getActiveVersion(
  characterId: string
): Promise<CharacterVersion | null> {
  const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');

  if (!currentRelease) {
    return null;
  }

  return characterRepo.getVersionById(currentRelease.characterVersionId);
}

/**
 * Check if a version can be published (all dependencies exist).
 */
export async function canPublish(draftId: string): Promise<{
  canPublish: boolean;
  missingDependencies: string[];
}> {
  const draft = getDraft(draftId);
  if (!draft) {
    return { canPublish: false, missingDependencies: ['Draft not found'] };
  }

  const missing: string[] = [];

  if (!draft.data.phaseGraphVersionId) {
    missing.push('Phase graph');
  }

  if (!draft.data.promptBundleVersionId) {
    missing.push('Prompt bundle');
  }

  if (!draft.data.persona.summary) {
    missing.push('Character summary');
  }

  return {
    canPublish: missing.length === 0,
    missingDependencies: missing,
  };
}
