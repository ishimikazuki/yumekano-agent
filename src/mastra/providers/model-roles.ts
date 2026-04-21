/**
 * Logical model roles for the agent system.
 * These abstract away specific model IDs so we can swap providers easily.
 *
 * Roles are split by responsibility so each stage can be tuned independently:
 *
 * - surfaceResponseHigh:     generator (direct user-facing reply)
 * - decisionHigh:            planner / ranker / CoE extractor / scorers
 *                            (shape what the user will see)
 * - structuredPostturnFast:  memory extractor (runs after the reply is
 *                            already finalized — safe to run on a fast tier)
 * - maintenanceFast:         reflector / narrator / consolidation /
 *                            design-time persona compilation
 * - embeddingDefault:        vector embeddings
 */
export type ModelRole =
  | 'surfaceResponseHigh'
  | 'decisionHigh'
  | 'structuredPostturnFast'
  | 'maintenanceFast'
  | 'embeddingDefault';

export type ModelRoleConfig = {
  [K in ModelRole]: {
    provider: string;
    modelId: string;
  };
};

const SURFACE_MODEL = process.env.CONVERSATION_MODEL || 'grok-4.20-reasoning';
const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL || 'grok-4-1-fast-reasoning';

/**
 * T2-B: memory extractor and maintenance stages run after the user-facing
 * reply is finalized, so they can use a faster, cheaper tier without
 * affecting the current-turn surface quality. Default to grok-4-fast-reasoning.
 *
 * Override via STRUCTURED_POSTTURN_MODEL / MAINTENANCE_MODEL if needed.
 */
const STRUCTURED_POSTTURN_MODEL =
  process.env.STRUCTURED_POSTTURN_MODEL || 'grok-4-fast-reasoning';
const MAINTENANCE_MODEL =
  process.env.MAINTENANCE_MODEL || 'grok-4-fast-reasoning';

/**
 * Default model role configuration using xAI Grok.
 *
 * T2 note: non-user-facing stages (memory extractor, reflector,
 * narrator, persona compiler) are on a faster tier than the decision
 * stack. Generator/planner/ranker/CoE-extractor stay on the high tier.
 *
 * T6 note: the default matches `operationalProfiles.poc_balanced_latency`.
 */
export const defaultModelRoles: ModelRoleConfig = {
  surfaceResponseHigh: {
    provider: 'xai',
    modelId: SURFACE_MODEL,
  },
  decisionHigh: {
    provider: 'xai',
    modelId: ANALYSIS_MODEL,
  },
  structuredPostturnFast: {
    provider: 'xai',
    modelId: STRUCTURED_POSTTURN_MODEL,
  },
  maintenanceFast: {
    provider: 'xai',
    modelId: MAINTENANCE_MODEL,
  },
  embeddingDefault: {
    provider: 'xai',
    modelId: 'v1', // xAI embedding model
  },
};

/**
 * T6: operational profiles for POC rollout.
 *
 * - `poc_quality_first`: every analysis stage on the high tier
 *   (grok-4-1-fast-reasoning). No latency trade-off. Used as a quality
 *   reference and as the rollback profile if the balanced profile
 *   shows regression in live ops.
 *
 * - `poc_balanced_latency`: surface + decision stack on the high tier,
 *   memory extractor + maintenance on the fast tier
 *   (grok-4-fast-reasoning). This is the T6 recommended default and
 *   matches `defaultModelRoles`.
 */
export const operationalProfiles: Record<string, ModelRoleConfig> = {
  poc_quality_first: {
    surfaceResponseHigh: { provider: 'xai', modelId: SURFACE_MODEL },
    decisionHigh: { provider: 'xai', modelId: ANALYSIS_MODEL },
    structuredPostturnFast: { provider: 'xai', modelId: ANALYSIS_MODEL },
    maintenanceFast: { provider: 'xai', modelId: ANALYSIS_MODEL },
    embeddingDefault: { provider: 'xai', modelId: 'v1' },
  },
  poc_balanced_latency: {
    surfaceResponseHigh: { provider: 'xai', modelId: SURFACE_MODEL },
    decisionHigh: { provider: 'xai', modelId: ANALYSIS_MODEL },
    structuredPostturnFast: { provider: 'xai', modelId: STRUCTURED_POSTTURN_MODEL },
    maintenanceFast: { provider: 'xai', modelId: MAINTENANCE_MODEL },
    embeddingDefault: { provider: 'xai', modelId: 'v1' },
  },
};

/** T6 recommended default profile name. */
export const RECOMMENDED_PROFILE = 'poc_balanced_latency' as const;
