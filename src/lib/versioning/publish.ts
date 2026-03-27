/**
 * Publish utilities for creating immutable releases.
 *
 * Publishing creates a new version from a draft and optionally activates it.
 */

import {
  characterRepo,
  phaseGraphRepo,
  promptBundleRepo,
  releaseRepo,
  workspaceRepo,
} from '../repositories';
import { preparePublishedPersona } from '../persona';
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
  createdAt?: Date;
  publishedAt?: Date;
}

export interface PublishWorkspaceOptions {
  workspaceId: string;
  label: string;
  publishedBy: string;
  activateImmediately?: boolean;
}

/**
 * Canonical T7 publish flow: workspace draft -> version artifacts -> release.
 */
export async function publishWorkspaceDraft(
  options: PublishWorkspaceOptions
): Promise<PublishResult> {
  const {
    workspaceId,
    label,
    publishedBy,
    activateImmediately = true,
  } = options;
  const workspace = await workspaceRepo.getWithDraft(workspaceId);

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  validateWorkspaceDraftForPublish(workspace.draft);

  const phaseGraphVersion = await phaseGraphRepo.create({
    characterId: workspace.characterId,
    graph: workspace.draft.phaseGraph,
  });
  const promptBundleVersion = await promptBundleRepo.create({
    characterId: workspace.characterId,
    prompts: workspace.draft.prompts,
  });
  const persona = await preparePublishedPersona(workspace.draft.persona);
  const newVersion = await characterRepo.createVersion({
    characterId: workspace.characterId,
    persona,
    style: workspace.draft.style,
    autonomy: workspace.draft.autonomy,
    emotion: workspace.draft.emotion,
    memory: workspace.draft.memory,
    phaseGraphVersionId: phaseGraphVersion.id,
    promptBundleVersionId: promptBundleVersion.id,
    createdBy: publishedBy,
    status: activateImmediately ? 'published' : 'draft',
    label,
    parentVersionId: workspace.draft.baseVersionId,
  });

  const result: PublishResult = {
    versionId: newVersion.id,
    versionNumber: newVersion.versionNumber,
    createdAt: newVersion.createdAt,
  };

  if (activateImmediately) {
    await characterRepo.archivePublishedVersionsExcept(
      workspace.characterId,
      newVersion.id
    );

    const release = await releaseRepo.create({
      characterId: workspace.characterId,
      characterVersionId: newVersion.id,
      channel: 'prod',
      publishedBy,
    });

    result.releaseId = release.id;
    result.publishedAt = release.publishedAt;
  }

  await workspaceRepo.updateDraftSection(workspaceId, 'baseVersionId', newVersion.id);
  await characterRepo.updateDisplayName(
    workspace.characterId,
    workspace.draft.identity.displayName
  );

  return result;
}

/**
 * @deprecated Legacy in-memory draft publishing path kept only for compatibility.
 * Canonical publish now runs through `publishWorkspaceDraft`.
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
  const persona = await preparePublishedPersona(draft.data.persona);
  const newVersion = await characterRepo.createVersion({
    characterId: draft.characterId,
    persona,
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
    createdAt: newVersion.createdAt,
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

function validateWorkspaceDraftForPublish(draft: {
  persona: { summary: string };
  identity: { displayName: string };
}): void {
  const errors: string[] = [];

  if (!draft.identity.displayName || draft.identity.displayName.trim() === '') {
    errors.push('Character display name is required');
  }

  if (!draft.persona.summary || draft.persona.summary.trim() === '') {
    errors.push('Character summary is required');
  }

  if (errors.length > 0) {
    throw new Error(`Draft validation failed:\n${errors.join('\n')}`);
  }
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
 * @deprecated Legacy in-memory draft compatibility check.
 * Canonical publish readiness should be checked from the workspace draft.
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
