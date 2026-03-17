import { z } from 'zod';
import { TurnPlanSchema } from './plan';

/**
 * Candidate response with scores
 */
export const CandidateSchema = z.object({
  index: z.number().int().min(0),
  text: z.string(),
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
  summary: z.string(),
});
export type MemoryWrite = z.infer<typeof MemoryWriteSchema>;

/**
 * PAD state (Pleasure-Arousal-Dominance)
 */
export const PADStateSchema = z.object({
  pleasure: z.number().min(-1).max(1),
  arousal: z.number().min(-1).max(1),
  dominance: z.number().min(-1).max(1),
});
export type PADState = z.infer<typeof PADStateSchema>;

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
  appraisal: AppraisalVectorSchema,
  retrievedMemoryIds: z.object({
    events: z.array(z.string().uuid()),
    facts: z.array(z.string().uuid()),
    observations: z.array(z.string().uuid()),
    threads: z.array(z.string().uuid()),
  }),
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
