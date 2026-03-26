import { z } from 'zod';
import { PADStateSchema, RelationshipMetricsSchema } from './emotion-state';

export const CoEEvidenceSourceSchema = z.enum([
  'user_message',
  'recent_dialogue',
  'working_memory',
  'open_thread',
  'retrieved_fact',
  'retrieved_event',
  'retrieved_observation',
  'legacy_appraisal',
  'model_inference',
]);
export type CoEEvidenceSource = z.infer<typeof CoEEvidenceSourceSchema>;

export const CoEEvidenceSchema = z.object({
  source: CoEEvidenceSourceSchema,
  key: z.string().min(1),
  summary: z.string().min(1),
  weight: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).default(0.5),
  valence: z.number().min(-1).max(1).default(0),
});
export type CoEEvidence = z.infer<typeof CoEEvidenceSchema>;

export const PairMetricDeltaSchema = z.object({
  affinity: z.number(),
  trust: z.number(),
  intimacyReadiness: z.number(),
  conflict: z.number(),
});
export type PairMetricDelta = z.infer<typeof PairMetricDeltaSchema>;

export const EmotionContractSourceSchema = z.enum(['legacy_heuristic', 'model']);
export type EmotionContractSource = z.infer<typeof EmotionContractSourceSchema>;

export const RelationalAppraisalSchema = z.object({
  source: EmotionContractSourceSchema,
  summary: z.string().min(1),
  warmthSignal: z.number().min(-1).max(1),
  reciprocitySignal: z.number().min(-1).max(1),
  safetySignal: z.number().min(-1).max(1),
  boundaryRespect: z.number().min(-1).max(1),
  pressureSignal: z.number().min(0).max(1),
  repairSignal: z.number().min(-1).max(1),
  intimacySignal: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1).default(0.5),
  evidence: z.array(CoEEvidenceSchema).default([]),
});
export type RelationalAppraisal = z.infer<typeof RelationalAppraisalSchema>;

export const EmotionUpdateProposalSchema = z.object({
  source: EmotionContractSourceSchema,
  rationale: z.string().min(1),
  appraisal: RelationalAppraisalSchema,
  padDelta: PADStateSchema,
  pairDelta: PairMetricDeltaSchema,
  confidence: z.number().min(0).max(1).default(0.5),
  evidence: z.array(CoEEvidenceSchema).default([]),
});
export type EmotionUpdateProposal = z.infer<typeof EmotionUpdateProposalSchema>;

export const EmotionTraceSchema = z.object({
  source: EmotionContractSourceSchema,
  evidence: z.array(CoEEvidenceSchema).default([]),
  relationalAppraisal: RelationalAppraisalSchema,
  proposal: EmotionUpdateProposalSchema,
  emotionBefore: PADStateSchema,
  emotionAfter: PADStateSchema,
  pairMetricsBefore: RelationshipMetricsSchema,
  pairMetricsAfter: RelationshipMetricsSchema,
  pairMetricDelta: PairMetricDeltaSchema,
});
export type EmotionTrace = z.infer<typeof EmotionTraceSchema>;
