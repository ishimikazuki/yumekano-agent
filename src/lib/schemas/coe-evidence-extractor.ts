import { z } from 'zod';

export const InteractionActTypeSchema = z.enum([
  'compliment',
  'gratitude',
  'support',
  'question',
  'rejection',
  'insult',
  'apology',
  'repair',
  'pressure',
  'intimacy_bid',
  'boundary_test',
  'boundary_respect',
  'topic_shift',
  'disengagement',
  'affection',
  'other',
]);
export type InteractionActType = z.infer<typeof InteractionActTypeSchema>;

export const InteractionTargetSchema = z.enum([
  'character',
  'relationship',
  'boundary',
  'topic',
  'self',
  'memory',
  'phase',
  'unknown',
]);
export type InteractionTarget = z.infer<typeof InteractionTargetSchema>;

export const InteractionPolaritySchema = z.enum([
  'positive',
  'negative',
  'mixed',
  'neutral',
]);
export type InteractionPolarity = z.infer<typeof InteractionPolaritySchema>;

export const EvidenceSpanSourceSchema = z.enum([
  'user_message',
  'recent_dialogue',
  'working_memory',
  'retrieved_fact',
  'retrieved_event',
  'retrieved_observation',
  'retrieved_thread',
  'open_thread',
]);
export type EvidenceSpanSource = z.infer<typeof EvidenceSpanSourceSchema>;

export const EvidenceSpanSchema = z
  .object({
    source: EvidenceSpanSourceSchema,
    sourceId: z.string().nullable().default(null),
    text: z.string().min(1),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  })
  .refine((value) => value.end >= value.start, {
    message: 'Evidence span end must be greater than or equal to start',
    path: ['end'],
  });
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

export const ExtractedInteractionActSchema = z.object({
  act: InteractionActTypeSchema,
  target: InteractionTargetSchema,
  polarity: InteractionPolaritySchema,
  intensity: z.number().min(0).max(1),
  evidenceSpans: z.array(EvidenceSpanSchema).min(1),
  confidence: z.number().min(0).max(1),
  uncertaintyNotes: z.array(z.string()).default([]),
});
export type ExtractedInteractionAct = z.infer<typeof ExtractedInteractionActSchema>;

export const CoEEvidenceExtractorResultSchema = z.object({
  interactionActs: z.array(ExtractedInteractionActSchema).min(1),
  confidence: z.number().min(0).max(1),
  uncertaintyNotes: z.array(z.string()).default([]),
});
export type CoEEvidenceExtractorResult = z.infer<
  typeof CoEEvidenceExtractorResultSchema
>;
