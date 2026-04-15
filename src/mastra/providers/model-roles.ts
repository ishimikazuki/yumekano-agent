/**
 * Logical model roles for the agent system.
 * These abstract away specific model IDs so we can swap providers easily.
 */
export type ModelRole =
  | 'conversationHigh'  // Main conversation generation
  | 'analysisMedium'    // Planning, ranking, extraction
  | 'embeddingDefault'; // Vector embeddings

export type ModelRoleConfig = {
  [K in ModelRole]: {
    provider: string;
    modelId: string;
  };
};

/**
 * Default model role configuration using xAI Grok.
 * Override via CONVERSATION_MODEL / ANALYSIS_MODEL env vars.
 */
export const defaultModelRoles: ModelRoleConfig = {
  conversationHigh: {
    provider: 'xai',
    modelId: process.env.CONVERSATION_MODEL || 'grok-4.20-reasoning',
  },
  analysisMedium: {
    provider: 'xai',
    modelId: process.env.ANALYSIS_MODEL || 'grok-4-1-fast-reasoning',
  },
  embeddingDefault: {
    provider: 'xai',
    modelId: 'v1', // xAI embedding model
  },
};
