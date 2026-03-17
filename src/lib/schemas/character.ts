import { z } from 'zod';

/**
 * Persona specification - character identity and behavior
 */
export const PersonaSpecSchema = z.object({
  summary: z.string().describe('Brief character description'),
  values: z.array(z.string()).describe('Core values the character holds'),
  flaws: z.array(z.string()).describe('Character flaws and weaknesses'),
  insecurities: z.array(z.string()).describe('Personal insecurities'),
  likes: z.array(z.string()).describe('Things the character enjoys'),
  dislikes: z.array(z.string()).describe('Things the character dislikes'),
  signatureBehaviors: z.array(z.string()).describe('Distinctive behavioral patterns'),
  authoredExamples: z.object({
    warm: z.array(z.string()).optional(),
    playful: z.array(z.string()).optional(),
    guarded: z.array(z.string()).optional(),
    conflict: z.array(z.string()).optional(),
  }).describe('Example lines for different emotional states'),
});
export type PersonaSpec = z.infer<typeof PersonaSpecSchema>;

/**
 * Style specification - communication style parameters
 */
export const StyleSpecSchema = z.object({
  language: z.literal('ja').describe('Language code'),
  politenessDefault: z.enum(['casual', 'mixed', 'polite']).describe('Default politeness level'),
  terseness: z.number().min(0).max(1).describe('0=verbose, 1=terse'),
  directness: z.number().min(0).max(1).describe('0=indirect, 1=direct'),
  playfulness: z.number().min(0).max(1).describe('0=serious, 1=playful'),
  teasing: z.number().min(0).max(1).describe('0=no teasing, 1=frequent teasing'),
  initiative: z.number().min(0).max(1).describe('0=reactive, 1=proactive'),
  emojiRate: z.number().min(0).max(1).describe('Frequency of emoji usage'),
  sentenceLengthBias: z.enum(['short', 'medium']).describe('Preferred sentence length'),
  tabooPhrases: z.array(z.string()).describe('Phrases to never use'),
  signaturePhrases: z.array(z.string()).describe('Character signature expressions'),
});
export type StyleSpec = z.infer<typeof StyleSpecSchema>;

/**
 * Autonomy specification - character independence parameters
 */
export const AutonomySpecSchema = z.object({
  disagreeReadiness: z.number().min(0).max(1).describe('Willingness to disagree'),
  refusalReadiness: z.number().min(0).max(1).describe('Willingness to refuse requests'),
  delayReadiness: z.number().min(0).max(1).describe('Willingness to delay responses'),
  repairReadiness: z.number().min(0).max(1).describe('Willingness to repair conflicts'),
  conflictCarryover: z.number().min(0).max(1).describe('How much conflict persists'),
  intimacyNeverOnDemand: z.boolean().describe('Whether intimacy is never available on demand'),
});
export type AutonomySpec = z.infer<typeof AutonomySpecSchema>;

/**
 * Emotion specification - emotional parameters
 */
export const EmotionSpecSchema = z.object({
  baselinePAD: z.object({
    pleasure: z.number().min(-1).max(1),
    arousal: z.number().min(-1).max(1),
    dominance: z.number().min(-1).max(1),
  }).describe('Baseline emotional state'),
  recovery: z.object({
    pleasureHalfLifeTurns: z.number().positive(),
    arousalHalfLifeTurns: z.number().positive(),
    dominanceHalfLifeTurns: z.number().positive(),
  }).describe('Recovery speed for each dimension'),
  appraisalSensitivity: z.object({
    goalCongruence: z.number().min(0).max(1),
    controllability: z.number().min(0).max(1),
    certainty: z.number().min(0).max(1),
    normAlignment: z.number().min(0).max(1),
    attachmentSecurity: z.number().min(0).max(1),
    reciprocity: z.number().min(0).max(1),
    pressureIntrusiveness: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
  }).describe('Sensitivity to appraisal dimensions'),
  externalization: z.object({
    warmthWeight: z.number(),
    tersenessWeight: z.number(),
    directnessWeight: z.number(),
    teasingWeight: z.number(),
  }).describe('How emotions affect external behavior'),
});
export type EmotionSpec = z.infer<typeof EmotionSpecSchema>;

/**
 * Memory policy specification - memory system parameters
 */
export const MemoryPolicySpecSchema = z.object({
  eventSalienceThreshold: z.number().min(0).max(1).describe('Min salience to store event'),
  factConfidenceThreshold: z.number().min(0).max(1).describe('Min confidence to store fact'),
  observationCompressionTarget: z.number().positive().describe('Target token count for observations'),
  retrievalTopK: z.object({
    episodes: z.number().int().positive(),
    facts: z.number().int().positive(),
    observations: z.number().int().positive(),
  }).describe('Number of items to retrieve per type'),
  recencyBias: z.number().min(0).max(1).describe('Weight for recent items'),
  qualityBias: z.number().min(0).max(1).describe('Weight for high-quality items'),
  contradictionBoost: z.number().min(0).describe('Boost for contradictory items'),
});
export type MemoryPolicySpec = z.infer<typeof MemoryPolicySpecSchema>;

/**
 * Character version status
 */
export const CharacterVersionStatusSchema = z.enum(['draft', 'published', 'archived']);
export type CharacterVersionStatus = z.infer<typeof CharacterVersionStatusSchema>;

/**
 * Complete character version
 */
export const CharacterVersionSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: CharacterVersionStatusSchema,
  persona: PersonaSpecSchema,
  style: StyleSpecSchema,
  autonomy: AutonomySpecSchema,
  emotion: EmotionSpecSchema,
  memory: MemoryPolicySpecSchema,
  phaseGraphVersionId: z.string().uuid(),
  promptBundleVersionId: z.string().uuid(),
  createdBy: z.string(),
  createdAt: z.coerce.date(),
});
export type CharacterVersion = z.infer<typeof CharacterVersionSchema>;

/**
 * Character identity (stable)
 */
export const CharacterSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1),
  createdAt: z.coerce.date(),
});
export type Character = z.infer<typeof CharacterSchema>;
