/**
 * Draft asset source - loads from workspace draft state.
 */

import { workspaceRepo } from '../repositories';
import { normalizePersonaAuthoring } from '../persona';
import type { CharacterAssets, CharacterAssetSource } from './character-asset-source';

export class DraftAssetSource implements CharacterAssetSource {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  getSourceType(): 'draft' {
    return 'draft';
  }

  getSourceId(): string {
    return this.workspaceId;
  }

  async load(): Promise<CharacterAssets> {
    // Get workspace with draft
    const workspaceWithDraft = await workspaceRepo.getWithDraft(this.workspaceId);
    if (!workspaceWithDraft) {
      throw new Error(`Workspace ${this.workspaceId} not found or has no draft`);
    }

    const { draft } = workspaceWithDraft;

    return {
      sourceType: 'draft',
      sourceId: this.workspaceId,
      characterId: workspaceWithDraft.characterId,

      // Identity
      identity: draft.identity,

      // Configuration
      persona: normalizePersonaAuthoring(draft.persona),
      style: draft.style,
      autonomy: draft.autonomy,
      emotion: draft.emotion,
      memory: draft.memory,

      // Phase graph
      phaseGraph: draft.phaseGraph,
      entryPhaseId: draft.phaseGraph.entryPhaseId,

      // Prompts
      prompts: draft.prompts,
    };
  }
}

/**
 * Create a draft source for a workspace.
 * Returns null if workspace or draft doesn't exist.
 */
export async function createDraftSource(
  workspaceId: string
): Promise<DraftAssetSource | null> {
  const workspace = await workspaceRepo.getWithDraft(workspaceId);
  if (!workspace) {
    return null;
  }
  return new DraftAssetSource(workspaceId);
}
