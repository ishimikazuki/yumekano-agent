import { z } from 'zod';

/**
 * Phase mode - where the character is in the relationship arc
 */
export const PhaseModeSchema = z.enum(['entry', 'relationship', 'girlfriend']);
export type PhaseMode = z.infer<typeof PhaseModeSchema>;

/**
 * Adult intimacy eligibility levels
 */
export const IntimacyEligibilitySchema = z.enum(['never', 'conditional', 'allowed']);
export type IntimacyEligibility = z.infer<typeof IntimacyEligibilitySchema>;

/**
 * Phase node - a single phase in the relationship graph
 */
export const PhaseNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  mode: PhaseModeSchema,
  authoredNotes: z.string().optional(),
  acceptanceProfile: z.object({
    warmthFloor: z.number().optional(),
    trustFloor: z.number().optional(),
    intimacyFloor: z.number().optional(),
    conflictCeiling: z.number().optional(),
  }).describe('Thresholds for phase behavior'),
  allowedActs: z.array(z.string()).describe('Dialogue acts allowed in this phase'),
  disallowedActs: z.array(z.string()).describe('Dialogue acts prohibited in this phase'),
  adultIntimacyEligibility: IntimacyEligibilitySchema.optional(),
});
export type PhaseNode = z.infer<typeof PhaseNodeSchema>;

/**
 * Transition condition types
 */
export const MetricConditionSchema = z.object({
  type: z.literal('metric'),
  field: z.enum(['trust', 'affinity', 'intimacy_readiness', 'conflict']),
  op: z.enum(['>=', '<=']),
  value: z.number(),
});

export const TopicConditionSchema = z.object({
  type: z.literal('topic'),
  topicKey: z.string(),
  minCount: z.number().int().optional(),
});

export const EventConditionSchema = z.object({
  type: z.literal('event'),
  eventKey: z.string(),
  exists: z.boolean(),
});

export const EmotionConditionSchema = z.object({
  type: z.literal('emotion'),
  field: z.enum(['pleasure', 'arousal', 'dominance']),
  op: z.enum(['>=', '<=']),
  value: z.number(),
});

export const OpenThreadConditionSchema = z.object({
  type: z.literal('openThread'),
  threadKey: z.string(),
  status: z.enum(['open', 'resolved']),
});

export const TimeConditionSchema = z.object({
  type: z.literal('time'),
  field: z.enum(['turnsSinceLastTransition', 'daysSinceEntry']),
  op: z.literal('>='),
  value: z.number(),
});

export const TransitionConditionSchema = z.discriminatedUnion('type', [
  MetricConditionSchema,
  TopicConditionSchema,
  EventConditionSchema,
  EmotionConditionSchema,
  OpenThreadConditionSchema,
  TimeConditionSchema,
]);
export type TransitionCondition = z.infer<typeof TransitionConditionSchema>;

/**
 * Phase edge - transition between phases
 */
export const PhaseEdgeSchema = z.object({
  id: z.string(),
  from: z.string().describe('Source phase ID'),
  to: z.string().describe('Target phase ID'),
  conditions: z.array(TransitionConditionSchema),
  allMustPass: z.boolean().describe('Whether all conditions must be met'),
  authoredBeat: z.string().optional().describe('Optional narrative beat description'),
});
export type PhaseEdge = z.infer<typeof PhaseEdgeSchema>;

/**
 * Phase graph - complete relationship progression graph
 */
export const PhaseGraphSchema = z.object({
  nodes: z.array(PhaseNodeSchema),
  edges: z.array(PhaseEdgeSchema),
  entryPhaseId: z.string().describe('Initial phase ID'),
});
export type PhaseGraph = z.infer<typeof PhaseGraphSchema>;

/**
 * Phase graph version - immutable version container
 */
export const PhaseGraphVersionSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  graph: PhaseGraphSchema,
  createdAt: z.coerce.date(),
});
export type PhaseGraphVersion = z.infer<typeof PhaseGraphVersionSchema>;
