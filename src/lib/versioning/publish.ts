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
import type { CharacterVersion, Release } from '../schemas';

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

