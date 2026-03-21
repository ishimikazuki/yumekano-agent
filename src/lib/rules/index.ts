export { computeAppraisal, type AppraisalInput } from './appraisal';
export { updatePAD, getPADLabel, computeExternalization, type PADInput, type PADUpdate } from './pad';
export { buildCoEExplanation, type CoEExplanation, type CoEDriver, type CoEAxisSummary } from './coe';
export { PhaseEngine, createPhaseEngine, type PhaseEngineContext, type PhaseTransitionResult } from './phase-engine';
export {
  DEFAULT_RANK_WEIGHTS,
  INTRODUCTION_WEIGHTS,
  DEEPENING_WEIGHTS,
  COMMITTED_WEIGHTS,
  INTIMACY_WEIGHTS,
  getWeightsForPhase,
  calculateWeightedScore,
  shouldHardReject,
  normalizeWeights,
  type RankWeights,
} from './rank-weights';
