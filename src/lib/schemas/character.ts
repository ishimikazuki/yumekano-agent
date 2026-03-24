import { z } from 'zod';

/**
 * Example lines for authored tone guidance
 */
export const AuthoredExamplesSchema = z.object({
  warm: z.array(z.string()).optional(),
  playful: z.array(z.string()).optional(),
  guarded: z.array(z.string()).optional(),
  conflict: z.array(z.string()).optional(),
}).describe('Example lines for different emotional states');
export type AuthoredExamples = z.infer<typeof AuthoredExamplesSchema>;

/**
 * Legacy inner world - preserved for backward compatibility
 */
export const InnerWorldSchema = z.object({
  coreDesire: z.string().describe('What the character wants most'),
  fear: z.string().describe('What the character fears'),
  wound: z.string().optional().describe('Past emotional wound'),
  coping: z.string().optional().describe('How they cope with stress'),
  growthArc: z.string().optional().describe('How they can grow'),
});
export type InnerWorld = z.infer<typeof InnerWorldSchema>;

/**
 * Legacy surface loop - preserved for backward compatibility
 */
export const SurfaceLoopSchema = z.object({
  defaultMood: z.string().describe('Usual emotional state'),
  stressBehavior: z.string().describe('How they act under stress'),
  joyBehavior: z.string().describe('How they express happiness'),
  conflictStyle: z.string().describe('How they handle conflict'),
  affectionStyle: z.string().describe('How they show love'),
});
export type SurfaceLoop = z.infer<typeof SurfaceLoopSchema>;

/**
 * Legacy anchor - preserved for backward compatibility
 */
export const AnchorSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  emotionalSignificance: z.string(),
});
export type Anchor = z.infer<typeof AnchorSchema>;

/**
 * Legacy topic pack - preserved for backward compatibility
 */
export const TopicPackSchema = z.object({
  key: z.string(),
  label: z.string(),
  triggers: z.array(z.string()),
  responseHints: z.array(z.string()),
  moodBias: z.object({
    pleasure: z.number().min(-1).max(1).optional(),
    arousal: z.number().min(-1).max(1).optional(),
    dominance: z.number().min(-1).max(1).optional(),
  }).optional(),
});
export type TopicPack = z.infer<typeof TopicPackSchema>;

/**
 * Legacy reaction pack - preserved for backward compatibility
 */
export const ReactionPackSchema = z.object({
  key: z.string(),
  label: z.string(),
  trigger: z.string().describe('What triggers this reaction'),
  responses: z.array(z.string()).describe('Example responses'),
  conditions: z.object({
    phaseMode: z.enum(['entry', 'relationship', 'girlfriend']).optional(),
    minTrust: z.number().optional(),
    maxConflict: z.number().optional(),
  }).optional(),
});
export type ReactionPack = z.infer<typeof ReactionPackSchema>;

/**
 * Hidden legacy authoring data kept for old drafts and versions
 */
export const LegacyPersonaAuthoringSchema = z.object({
  innerWorld: InnerWorldSchema.optional(),
  surfaceLoop: SurfaceLoopSchema.optional(),
  anchors: z.array(AnchorSchema).optional(),
  topicPacks: z.array(TopicPackSchema).optional(),
  reactionPacks: z.array(ReactionPackSchema).optional(),
});
export type LegacyPersonaAuthoring = z.infer<typeof LegacyPersonaAuthoringSchema>;

/**
 * Designer-facing persona authoring
 */
export const PersonaAuthoringSchema = z.object({
  summary: z.string().describe('Brief character description'),
  innerWorldNoteMd: z.string().optional().describe('Freeform notes about inner motives and relational interpretation'),
  values: z.array(z.string()).describe('Core values the character holds'),
  vulnerabilities: z.array(z.string()).describe('Merged weaknesses and insecurities'),
  likes: z.array(z.string()).optional().describe('Things the character enjoys'),
  dislikes: z.array(z.string()).optional().describe('Things the character dislikes'),
  signatureBehaviors: z.array(z.string()).optional().describe('Distinctive behavioral patterns'),
  authoredExamples: AuthoredExamplesSchema,
  legacyAuthoring: LegacyPersonaAuthoringSchema.optional(),
});
export type PersonaAuthoring = z.infer<typeof PersonaAuthoringSchema>;

/**
 * Publish-time compiled persona for runtime prompting
 */
export const CompiledPersonaSchema = z.object({
  oneLineCore: z.string().describe('Low-token core identity line'),
  desire: z.string().nullable().describe('Stable primary desire'),
  fear: z.string().nullable().describe('Stable primary fear'),
  protectiveStrategy: z.string().nullable().describe('How the character self-protects under stress'),
  attachmentStyleHint: z.string().nullable().describe('How the character interprets closeness'),
  conflictPattern: z.string().nullable().describe('How the character tends to handle conflict'),
  intimacyPattern: z.string().nullable().describe('How intimacy tends to be approached'),
  motivationalHooks: z.array(z.string()).describe('Stable motivational levers'),
  softBans: z.array(z.string()).describe('Soft content/behavior bans to avoid'),
  toneHints: z.array(z.string()).describe('Short stable surface-tone hints'),
});
export type CompiledPersona = z.infer<typeof CompiledPersonaSchema>;

/**
 * Runtime persona - published persona with optional compiled payload
 */
export const RuntimePersonaSchema = PersonaAuthoringSchema.extend({
  compiledPersona: CompiledPersonaSchema.optional(),
});
export type RuntimePersona = z.infer<typeof RuntimePersonaSchema>;

/**
 * Persona specification - runtime character identity and behavior
 */
export const PersonaSpecSchema = RuntimePersonaSchema;
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
    selfRelevance: z.number().min(0).max(1),
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
  label: z.string().optional().describe('Human-readable version name (e.g., "口癖調整版")'),
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
  parentVersionId: z.string().uuid().nullable().optional().describe('Previous version this was based on'),
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
