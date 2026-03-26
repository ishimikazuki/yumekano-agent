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

const RelationalAxisWeightsSchema = z.object({
  warmthSignal: z.number(),
  reciprocitySignal: z.number(),
  safetySignal: z.number(),
  boundaryRespect: z.number(),
  pressureSignal: z.number(),
  repairSignal: z.number(),
  intimacySignal: z.number(),
});
export type RelationalAxisWeights = z.infer<typeof RelationalAxisWeightsSchema>;

const StateIntegratorModifierSchema = z.object({
  pleasure: z.number(),
  arousal: z.number(),
  dominance: z.number(),
  trust: z.number(),
  affinity: z.number(),
  conflict: z.number(),
  intimacyReadiness: z.number(),
});
export type StateIntegratorModifier = z.infer<typeof StateIntegratorModifierSchema>;

export const DEFAULT_COE_INTEGRATOR_CONFIG = {
  padWeights: {
    pleasure: {
      warmthSignal: 0.22,
      reciprocitySignal: 0.12,
      safetySignal: 0.16,
      boundaryRespect: 0.12,
      pressureSignal: -0.28,
      repairSignal: 0.14,
      intimacySignal: 0.1,
    },
    arousal: {
      warmthSignal: 0.04,
      reciprocitySignal: 0.02,
      safetySignal: -0.1,
      boundaryRespect: -0.06,
      pressureSignal: 0.24,
      repairSignal: -0.12,
      intimacySignal: 0.14,
    },
    dominance: {
      warmthSignal: 0.04,
      reciprocitySignal: 0.06,
      safetySignal: 0.24,
      boundaryRespect: 0.18,
      pressureSignal: -0.26,
      repairSignal: 0.12,
      intimacySignal: 0.08,
    },
  },
  pairWeights: {
    trust: {
      warmthSignal: 2.8,
      reciprocitySignal: 2.2,
      safetySignal: 3.4,
      boundaryRespect: 2.4,
      pressureSignal: -5.6,
      repairSignal: 3,
      intimacySignal: 0.8,
    },
    affinity: {
      warmthSignal: 3.4,
      reciprocitySignal: 2.5,
      safetySignal: 1.6,
      boundaryRespect: 1.2,
      pressureSignal: -4.2,
      repairSignal: 2.2,
      intimacySignal: 1.8,
    },
    conflict: {
      warmthSignal: -1.6,
      reciprocitySignal: -1.4,
      safetySignal: -2.4,
      boundaryRespect: -2,
      pressureSignal: 6.4,
      repairSignal: -2.8,
      intimacySignal: -0.6,
    },
    intimacyReadiness: {
      warmthSignal: 1.8,
      reciprocitySignal: 1.2,
      safetySignal: 2,
      boundaryRespect: 1.4,
      pressureSignal: -5,
      repairSignal: 1.2,
      intimacySignal: 3.6,
    },
  },
  impulse: {
    fastAffectBlend: 1,
    slowMoodBlend: 0.35,
    combinedFastRatio: 0.58,
  },
  relationship: {
    neutralBaseline: {
      affinity: 50,
      trust: 50,
      intimacyReadiness: 0,
      conflict: 0,
    },
    quietTurnThreshold: 0.12,
    quietDecay: {
      affinity: 0.03,
      trust: 0.04,
      intimacyReadiness: 0.08,
      conflict: 0.12,
    },
    edgeResistance: {
      affinity: 0.9,
      trust: 0.9,
      intimacyReadiness: 1.1,
      conflict: 1,
    },
  },
  phaseModifiers: {
    entry: {
      pleasure: 0.95,
      arousal: 1,
      dominance: 0.9,
      trust: 0.95,
      affinity: 0.95,
      conflict: 1.1,
      intimacyReadiness: 0.45,
    },
    relationship: {
      pleasure: 1,
      arousal: 1,
      dominance: 1,
      trust: 1,
      affinity: 1,
      conflict: 1,
      intimacyReadiness: 1,
    },
    girlfriend: {
      pleasure: 1.08,
      arousal: 0.98,
      dominance: 1.05,
      trust: 1.05,
      affinity: 1.08,
      conflict: 0.92,
      intimacyReadiness: 1.15,
    },
  },
  eligibilityModifiers: {
    never: {
      pleasure: 0.95,
      arousal: 1,
      dominance: 0.95,
      trust: 1,
      affinity: 1,
      conflict: 1.1,
      intimacyReadiness: 0.15,
    },
    conditional: {
      pleasure: 1,
      arousal: 1,
      dominance: 1,
      trust: 1,
      affinity: 1,
      conflict: 1,
      intimacyReadiness: 1,
    },
    allowed: {
      pleasure: 1.02,
      arousal: 1,
      dominance: 1,
      trust: 1,
      affinity: 1.05,
      conflict: 0.95,
      intimacyReadiness: 1.12,
    },
  },
  openThreadBias: {
    pleasurePerThreadSeverity: -0.04,
    dominancePerThreadSeverity: -0.03,
    trustPerThreadSeverity: -0.7,
    affinityPerThreadSeverity: -0.5,
    conflictPerThreadSeverity: 0.8,
    intimacyPerThreadSeverity: -0.25,
  },
  guardrails: {
    insultShock: {
      pleasure: -0.12,
      arousal: 0.08,
      dominance: -0.08,
      trust: -2.4,
      affinity: -1.8,
      conflict: 3.4,
      intimacyReadiness: -1.2,
    },
    apologyRepair: {
      pleasure: 0.06,
      arousal: -0.06,
      dominance: 0.04,
      trust: 2.2,
      affinity: 1.2,
      conflict: -2.4,
      intimacyReadiness: 0.6,
    },
    sustainedPressure: {
      pleasure: -0.09,
      arousal: 0.06,
      dominance: -0.08,
      trust: -2.6,
      affinity: -1.4,
      conflict: 3,
      intimacyReadiness: -2.2,
    },
    consentBoundary: {
      pleasure: -0.08,
      arousal: 0.05,
      dominance: -0.06,
      trust: -2.1,
      affinity: -1,
      conflict: 2.4,
      intimacyReadiness: -4,
    },
  },
} as const;

export const CoEIntegratorConfigSchema = z.object({
  padWeights: z.object({
    pleasure: RelationalAxisWeightsSchema,
    arousal: RelationalAxisWeightsSchema,
    dominance: RelationalAxisWeightsSchema,
  }),
  pairWeights: z.object({
    trust: RelationalAxisWeightsSchema,
    affinity: RelationalAxisWeightsSchema,
    conflict: RelationalAxisWeightsSchema,
    intimacyReadiness: RelationalAxisWeightsSchema,
  }),
  impulse: z.object({
    fastAffectBlend: z.number().min(0).max(2),
    slowMoodBlend: z.number().min(0).max(1),
    combinedFastRatio: z.number().min(0).max(1),
  }),
  relationship: z.object({
    neutralBaseline: z.object({
      affinity: z.number().min(0).max(100),
      trust: z.number().min(0).max(100),
      intimacyReadiness: z.number().min(0).max(100),
      conflict: z.number().min(0).max(100),
    }),
    quietTurnThreshold: z.number().min(0).max(1),
    quietDecay: z.object({
      affinity: z.number().min(0).max(1),
      trust: z.number().min(0).max(1),
      intimacyReadiness: z.number().min(0).max(1),
      conflict: z.number().min(0).max(1),
    }),
    edgeResistance: z.object({
      affinity: z.number().min(0).max(3),
      trust: z.number().min(0).max(3),
      intimacyReadiness: z.number().min(0).max(3),
      conflict: z.number().min(0).max(3),
    }),
  }),
  phaseModifiers: z.object({
    entry: StateIntegratorModifierSchema,
    relationship: StateIntegratorModifierSchema,
    girlfriend: StateIntegratorModifierSchema,
  }),
  eligibilityModifiers: z.object({
    never: StateIntegratorModifierSchema,
    conditional: StateIntegratorModifierSchema,
    allowed: StateIntegratorModifierSchema,
  }),
  openThreadBias: z.object({
    pleasurePerThreadSeverity: z.number().min(-1).max(1),
    dominancePerThreadSeverity: z.number().min(-1).max(1),
    trustPerThreadSeverity: z.number(),
    affinityPerThreadSeverity: z.number(),
    conflictPerThreadSeverity: z.number(),
    intimacyPerThreadSeverity: z.number(),
  }),
  guardrails: z.object({
    insultShock: StateIntegratorModifierSchema,
    apologyRepair: StateIntegratorModifierSchema,
    sustainedPressure: StateIntegratorModifierSchema,
    consentBoundary: StateIntegratorModifierSchema,
  }),
});
export type CoEIntegratorConfig = z.infer<typeof CoEIntegratorConfigSchema>;

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
  coeIntegrator: CoEIntegratorConfigSchema.default(DEFAULT_COE_INTEGRATOR_CONFIG),
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
