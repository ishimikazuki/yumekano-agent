import { z } from 'zod';

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

export const PADTransitionContributionSchema = z.object({
  source: z.enum(['appraisal', 'decay', 'open_thread_bias', 'blend', 'clamp']),
  axis: z.enum(['pleasure', 'arousal', 'dominance']),
  delta: z.number(),
  reason: z.string(),
});
export type PADTransitionContribution = z.infer<typeof PADTransitionContributionSchema>;
