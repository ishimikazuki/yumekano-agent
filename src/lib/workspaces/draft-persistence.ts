import { normalizePersonaAuthoring } from '@/lib/persona';
import { PromptBundleContentSchema, type DraftState } from '@/lib/schemas';

export type SerializedDraftState = {
  identityJson: string;
  personaJson: string;
  styleJson: string;
  autonomyJson: string;
  emotionJson: string;
  memoryPolicyJson: string;
  phaseGraphJson: string;
  plannerMd: string;
  generatorMd: string;
  generatorIntimacyMd: string;
  extractorMd: string;
  reflectorMd: string;
  rankerMd: string;
  baseVersionId: string | null;
};

export function serializeDraftStateForStorage(draft: DraftState): SerializedDraftState {
  const prompts = PromptBundleContentSchema.parse(draft.prompts);

  return {
    identityJson: JSON.stringify(draft.identity),
    personaJson: JSON.stringify(normalizePersonaAuthoring(draft.persona)),
    styleJson: JSON.stringify(draft.style),
    autonomyJson: JSON.stringify(draft.autonomy),
    emotionJson: JSON.stringify(draft.emotion),
    memoryPolicyJson: JSON.stringify(draft.memory),
    phaseGraphJson: JSON.stringify(draft.phaseGraph),
    plannerMd: prompts.plannerMd,
    generatorMd: prompts.generatorMd,
    generatorIntimacyMd: prompts.generatorIntimacyMd,
    extractorMd: prompts.extractorMd,
    reflectorMd: prompts.reflectorMd,
    rankerMd: prompts.rankerMd,
    baseVersionId: draft.baseVersionId,
  };
}
