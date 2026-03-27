/**
 * Legacy draft management utilities.
 *
 * T7 defines the canonical draft flow as workspace-backed draft state stored in
 * `workspace_draft_state` and published via `publishWorkspaceDraft`.
 *
 * This module is kept only as a deprecated compatibility boundary for older
 * in-memory callers that have not been migrated yet.
 */

import { v4 as uuid } from 'uuid';
import { characterRepo } from '../repositories';
import { toPersonaAuthoring } from '../persona';
import { DEFAULT_COE_INTEGRATOR_CONFIG } from '../schemas';
import type {
  CharacterVersion,
  PersonaAuthoring,
  StyleSpec,
  AutonomySpec,
  EmotionSpec,
  MemoryPolicySpec,
} from '../schemas';

export interface DraftData {
  persona: PersonaAuthoring;
  style: StyleSpec;
  autonomy: AutonomySpec;
  emotion: EmotionSpec;
  memory: MemoryPolicySpec;
  phaseGraphVersionId: string;
  promptBundleVersionId: string;
}

export interface DraftVersion {
  id: string;
  characterId: string;
  baseVersionId: string | null;
  isDraft: true;
  data: DraftData;
  createdAt: string;
  updatedAt: string;
}

// Deprecated legacy in-memory draft storage.
const drafts = new Map<string, DraftVersion>();

/**
 * @deprecated Use workspace-backed draft state instead.
 * Create a new draft from an existing version or from scratch.
 */
export async function createDraft(input: {
  characterId: string;
  baseVersionId?: string;
}): Promise<DraftVersion> {
  const { characterId, baseVersionId } = input;

  // If base version provided, copy from it
  let baseData: DraftData | null = null;
  if (baseVersionId) {
    const baseVersion = await characterRepo.getVersionById(baseVersionId);
    if (!baseVersion) {
      throw new Error(`Base version ${baseVersionId} not found`);
    }
    baseData = {
      persona: toPersonaAuthoring(baseVersion.persona),
      style: baseVersion.style,
      autonomy: baseVersion.autonomy,
      emotion: baseVersion.emotion,
      memory: baseVersion.memory,
      phaseGraphVersionId: baseVersion.phaseGraphVersionId,
      promptBundleVersionId: baseVersion.promptBundleVersionId,
    };
  }

  const draft: DraftVersion = {
    id: `draft-${uuid()}`,
    characterId,
    baseVersionId: baseVersionId ?? null,
    isDraft: true,
    data: baseData ?? getDefaultDraftData(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  drafts.set(draft.id, draft);
  return draft;
}

/**
 * @deprecated Use `workspaceRepo.getDraft` instead.
 * Get a draft by ID.
 */
export function getDraft(draftId: string): DraftVersion | null {
  return drafts.get(draftId) ?? null;
}

/**
 * @deprecated Use workspace queries instead.
 * Get all drafts for a character.
 */
export function getDraftsByCharacter(characterId: string): DraftVersion[] {
  return Array.from(drafts.values()).filter(d => d.characterId === characterId);
}

/**
 * @deprecated Use workspace-backed draft mutation instead.
 * Update a draft's data.
 */
export function updateDraft(
  draftId: string,
  updates: Partial<DraftData>
): DraftVersion {
  const draft = drafts.get(draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const updated: DraftVersion = {
    ...draft,
    data: {
      ...draft.data,
      ...updates,
    },
    updatedAt: new Date().toISOString(),
  };

  drafts.set(draftId, updated);
  return updated;
}

/**
 * @deprecated Use workspace-backed draft deletion instead.
 * Delete a draft.
 */
export function deleteDraft(draftId: string): boolean {
  return drafts.delete(draftId);
}

/**
 * @deprecated Use workspace-backed draft comparison instead.
 * Check if a draft has unsaved changes compared to its base.
 */
export async function hasChanges(draftId: string): Promise<boolean> {
  const draft = drafts.get(draftId);
  if (!draft || !draft.baseVersionId) {
    return true; // New drafts always have "changes"
  }

  const baseVersion = await characterRepo.getVersionById(draft.baseVersionId);
  if (!baseVersion) {
    return true;
  }

  // Deep compare (simplified - in production use a proper diff library)
  const baseData: DraftData = {
    persona: baseVersion.persona,
    style: baseVersion.style,
    autonomy: baseVersion.autonomy,
    emotion: baseVersion.emotion,
    memory: baseVersion.memory,
    phaseGraphVersionId: baseVersion.phaseGraphVersionId,
    promptBundleVersionId: baseVersion.promptBundleVersionId,
  };

  return JSON.stringify(draft.data) !== JSON.stringify(baseData);
}

/**
 * Get default draft data for a new character.
 */
function getDefaultDraftData(): DraftData {
  return {
    persona: {
      summary: '',
      innerWorldNoteMd: '',
      values: [],
      vulnerabilities: [],
      likes: [],
      dislikes: [],
      signatureBehaviors: [],
      authoredExamples: {},
    },
    style: {
      language: 'ja',
      politenessDefault: 'casual',
      terseness: 0.3,
      directness: 0.5,
      playfulness: 0.5,
      teasing: 0.3,
      initiative: 0.5,
      emojiRate: 0.2,
      sentenceLengthBias: 'medium',
      tabooPhrases: [],
      signaturePhrases: [],
    },
    autonomy: {
      disagreeReadiness: 0.5,
      refusalReadiness: 0.5,
      delayReadiness: 0.5,
      repairReadiness: 0.5,
      conflictCarryover: 0.3,
      intimacyNeverOnDemand: true,
    },
    emotion: {
      baselinePAD: { pleasure: 0.5, arousal: 0.3, dominance: 0.5 },
      recovery: {
        pleasureHalfLifeTurns: 5,
        arousalHalfLifeTurns: 3,
        dominanceHalfLifeTurns: 7,
      },
      appraisalSensitivity: {
        goalCongruence: 0.5,
        controllability: 0.5,
        certainty: 0.5,
        normAlignment: 0.5,
        attachmentSecurity: 0.5,
        reciprocity: 0.5,
        pressureIntrusiveness: 0.5,
        novelty: 0.5,
        selfRelevance: 0.5,
      },
      externalization: {
        warmthWeight: 0.3,
        tersenessWeight: 0.2,
        directnessWeight: 0.2,
        teasingWeight: 0.1,
      },
      coeIntegrator: DEFAULT_COE_INTEGRATOR_CONFIG,
    },
    memory: {
      eventSalienceThreshold: 0.3,
      factConfidenceThreshold: 0.5,
      observationCompressionTarget: 500,
      retrievalTopK: { episodes: 10, facts: 15, observations: 5 },
      recencyBias: 0.5,
      qualityBias: 0.3,
      contradictionBoost: 0.2,
    },
    phaseGraphVersionId: '',
    promptBundleVersionId: '',
  };
}
