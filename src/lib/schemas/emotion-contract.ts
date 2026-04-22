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
  'retrieved_thread',
  'legacy_appraisal',
  'model_inference',
]);
export type CoEEvidenceSource = z.infer<typeof CoEEvidenceSourceSchema>;

export const CoETargetSchema = z.enum([
  'assistant',
  'user',
  'relationship',
  'topic',
  'third_party',
]);
export type CoETarget = z.infer<typeof CoETargetSchema>;

export const CoEEvidenceSchema = z
  .object({
    acts: z.array(z.string().min(1)).min(1),
    target: CoETargetSchema,
    polarity: z.number().min(-1).max(1),
    intensity: z.number().min(0).max(1),
    evidenceSpans: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    uncertaintyNotes: z.array(z.string()),
  })
  .strict();
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

export const RelationalAppraisalSchema = z
  .object({
    warmthImpact: z.number().min(-1).max(1),
    rejectionImpact: z.number().min(-1).max(1),
    respectImpact: z.number().min(-1).max(1),
    threatImpact: z.number().min(-1).max(1),
    pressureImpact: z.number().min(-1).max(1),
    repairImpact: z.number().min(-1).max(1),
    reciprocityImpact: z.number().min(-1).max(1),
    intimacySignal: z.number().min(-1).max(1),
    boundarySignal: z.number().min(-1).max(1),
    certainty: z.number().min(0).max(1),
    // T-B: self-disclosure / vulnerability evidence. Optional so pre-T-B
    // payloads remain valid; consumers treat missing as 0. Positive values
    // indicate the character is showing vulnerability and should lower
    // dominance / build trust via the integrator's new axis weight.
    vulnerabilitySignal: z.number().min(-1).max(1).optional(),
  })
  .strict();
export type RelationalAppraisal = z.infer<typeof RelationalAppraisalSchema>;

export const EmotionStateDeltaSchema = z
  .object({
    padDelta: PADStateSchema,
    pairMetricDelta: PairMetricDeltaSchema,
    reasonRefs: z.array(z.string()),
    guardrailOverrides: z.array(z.string()),
  })
  .strict();
export type EmotionStateDelta = z.infer<typeof EmotionStateDeltaSchema>;

export const EmotionUpdateProposalSchema = EmotionStateDeltaSchema;
export type EmotionUpdateProposal = EmotionStateDelta;

export const EmotionTraceSchema = z.object({
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

// Legacy schemas — used by adapter and pre-T4 CoE pipeline code.
// These preserve the field names from the pre-T1 implementation.
// T4 will bridge these to the canonical T1 plan schemas above.

export const LegacyEvidenceItemSchema = z.object({
  source: CoEEvidenceSourceSchema,
  key: z.string().min(1),
  summary: z.string().min(1),
  weight: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).default(0.5),
  valence: z.number().min(-1).max(1).default(0),
});
export type LegacyEvidenceItem = z.infer<typeof LegacyEvidenceItemSchema>;

export const LegacyRelationalAppraisalSchema = z.object({
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
  evidence: z.array(LegacyEvidenceItemSchema).default([]),
});
export type LegacyRelationalAppraisal = z.infer<typeof LegacyRelationalAppraisalSchema>;

export const LegacyEmotionUpdateProposalSchema = z.object({
  source: EmotionContractSourceSchema,
  rationale: z.string().min(1),
  appraisal: LegacyRelationalAppraisalSchema,
  padDelta: PADStateSchema,
  pairDelta: PairMetricDeltaSchema,
  confidence: z.number().min(0).max(1).default(0.5),
  evidence: z.array(LegacyEvidenceItemSchema).default([]),
});
export type LegacyEmotionUpdateProposal = z.infer<typeof LegacyEmotionUpdateProposalSchema>;

export const LegacyEmotionTraceSchema = z.object({
  source: EmotionContractSourceSchema,
  evidence: z.array(LegacyEvidenceItemSchema).default([]),
  relationalAppraisal: LegacyRelationalAppraisalSchema,
  proposal: LegacyEmotionUpdateProposalSchema,
  emotionBefore: PADStateSchema,
  emotionAfter: PADStateSchema,
  pairMetricsBefore: RelationshipMetricsSchema,
  pairMetricsAfter: RelationshipMetricsSchema,
  pairMetricDelta: PairMetricDeltaSchema,
});
export type LegacyEmotionTrace = z.infer<typeof LegacyEmotionTraceSchema>;
