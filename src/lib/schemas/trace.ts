import { z } from 'zod';
import { TurnPlanSchema } from './plan';

/**
 * PAD state (Pleasure-Arousal-Dominance)
 */
export const PADStateSchema = z.object({
  pleasure: z.number().min(-1).max(1),
  arousal: z.number().min(-1).max(1),
  dominance: z.number().min(-1).max(1),
});
export type PADState = z.infer<typeof PADStateSchema>;

export const RuntimeEmotionStateSchema = z.object({
  fastAffect: PADStateSchema,
  slowMood: PADStateSchema,
  combined: PADStateSchema,
  lastUpdatedAt: z.coerce.date(),
});
export type RuntimeEmotionState = z.infer<typeof RuntimeEmotionStateSchema>;

export const RelationshipMetricsSchema = z.object({
  affinity: z.number().min(0).max(100),
  trust: z.number().min(0).max(100),
  intimacyReadiness: z.number().min(0).max(100),
  conflict: z.number().min(0).max(100),
});
export type RelationshipMetrics = z.infer<typeof RelationshipMetricsSchema>;

export const RelationshipMetricDeltaSchema = z.object({
  affinity: z.number(),
  trust: z.number(),
  intimacyReadiness: z.number(),
  conflict: z.number(),
});
export type RelationshipMetricDelta = z.infer<typeof RelationshipMetricDeltaSchema>;

export const PhaseTransitionEvaluationSchema = z.object({
  shouldTransition: z.boolean(),
  targetPhaseId: z.string().nullable(),
  reason: z.string(),
  satisfiedConditions: z.array(z.string()),
  failedConditions: z.array(z.string()),
});
export type PhaseTransitionEvaluation = z.infer<typeof PhaseTransitionEvaluationSchema>;

export const PromptAssemblyHashesSchema = z.object({
  planner: z.string(),
  generator: z.string(),
  ranker: z.string(),
  extractor: z.string(),
});
export type PromptAssemblyHashes = z.infer<typeof PromptAssemblyHashesSchema>;

export const MemoryThresholdDecisionSchema = z.object({
  kind: z.enum(['event', 'fact']),
  summary: z.string(),
  passed: z.boolean(),
  reason: z.string(),
});
export type MemoryThresholdDecision = z.infer<typeof MemoryThresholdDecisionSchema>;

export const PADTransitionContributionSchema = z.object({
  source: z.enum(['appraisal', 'decay', 'open_thread_bias', 'blend', 'clamp']),
  axis: z.enum(['pleasure', 'arousal', 'dominance']),
  delta: z.number(),
  reason: z.string(),
});
export type PADTransitionContribution = z.infer<typeof PADTransitionContributionSchema>;

/**
 * Candidate response with scores
 */
export const CandidateSchema = z.object({
  index: z.number().int().min(0),
  text: z.string(),
  toneTags: z.array(z.string()).default([]),
  memoryRefsUsed: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  scores: z.object({
    personaConsistency: z.number().min(0).max(1),
    phaseCompliance: z.number().min(0).max(1),
    memoryGrounding: z.number().min(0).max(1),
    emotionalCoherence: z.number().min(0).max(1),
    autonomy: z.number().min(0).max(1),
    naturalness: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  rejected: z.boolean(),
  rejectionReason: z.string().nullable(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

/**
 * Memory write record
 */
export const MemoryWriteSchema = z.object({
  type: z.enum(['event', 'fact', 'observation', 'thread_open', 'thread_resolve', 'working_memory']),
  itemId: z.string().uuid().nullable(),
  sourceTurnId: z.string().uuid().nullable(),
  summary: z.string(),
});
export type MemoryWrite = z.infer<typeof MemoryWriteSchema>;

/**
 * Appraisal vector
 */
export const AppraisalVectorSchema = z.object({
  goalCongruence: z.number().min(-1).max(1),
  controllability: z.number().min(0).max(1),
  certainty: z.number().min(0).max(1),
  normAlignment: z.number().min(-1).max(1),
  attachmentSecurity: z.number().min(0).max(1),
  reciprocity: z.number().min(-1).max(1),
  pressureIntrusiveness: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  selfRelevance: z.number().min(0).max(1),
});
export type AppraisalVector = z.infer<typeof AppraisalVectorSchema>;

/**
 * Turn trace - complete record of a turn for inspection
 */
export const TurnTraceSchema = z.object({
  id: z.string().uuid(),
  pairId: z.string().uuid(),
  characterVersionId: z.string().uuid(),
  promptBundleVersionId: z.string().uuid(),
  modelIds: z.object({
    planner: z.string(),
    generator: z.string(),
    ranker: z.string(),
    extractor: z.string().nullable(),
  }).describe('Model IDs used for each role'),
  phaseIdBefore: z.string(),
  phaseIdAfter: z.string(),
  emotionBefore: PADStateSchema,
  emotionAfter: PADStateSchema,
  emotionStateBefore: RuntimeEmotionStateSchema,
  emotionStateAfter: RuntimeEmotionStateSchema,
  relationshipBefore: RelationshipMetricsSchema,
  relationshipAfter: RelationshipMetricsSchema,
  relationshipDeltas: RelationshipMetricDeltaSchema,
  phaseTransitionEvaluation: PhaseTransitionEvaluationSchema,
  promptAssemblyHashes: PromptAssemblyHashesSchema,
  appraisal: AppraisalVectorSchema,
  retrievedMemoryIds: z.object({
    events: z.array(z.string().uuid()),
    facts: z.array(z.string().uuid()),
    observations: z.array(z.string().uuid()),
    threads: z.array(z.string().uuid()),
  }),
  memoryThresholdDecisions: z.array(MemoryThresholdDecisionSchema),
  coeContributions: z.array(PADTransitionContributionSchema),
  plan: TurnPlanSchema,
  candidates: z.array(CandidateSchema),
  winnerIndex: z.number().int().min(0),
  memoryWrites: z.array(MemoryWriteSchema),
  userMessage: z.string(),
  assistantMessage: z.string(),
  createdAt: z.coerce.date(),
});
export type TurnTrace = z.infer<typeof TurnTraceSchema>;

/**
 * Pair state - runtime state for user×character pair
 */
export const PairStateSchema = z.object({
  pairId: z.string().uuid(),
  activeCharacterVersionId: z.string().uuid(),
  activePhaseId: z.string(),
  affinity: z.number().min(0).max(100),
  trust: z.number().min(0).max(100),
  intimacyReadiness: z.number().min(0).max(100),
  conflict: z.number().min(0).max(100),
  emotion: RuntimeEmotionStateSchema,
  pad: PADStateSchema,
  appraisal: AppraisalVectorSchema,
  openThreadCount: z.number().int().min(0),
  lastTransitionAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
});
export type PairState = z.infer<typeof PairStateSchema>;

/**
 * Pair identity
 */
export const PairSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  characterId: z.string().uuid(),
  canonicalThreadId: z.string(),
  createdAt: z.coerce.date(),
});
export type Pair = z.infer<typeof PairSchema>;

/**
 * Chat turn record
 */
export const ChatTurnSchema = z.object({
  id: z.string().uuid(),
  pairId: z.string().uuid(),
  threadId: z.string(),
  userMessageText: z.string(),
  assistantMessageText: z.string(),
  plannerJson: z.unknown(),
  rankerJson: z.unknown(),
  traceId: z.string().uuid(),
  createdAt: z.coerce.date(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
