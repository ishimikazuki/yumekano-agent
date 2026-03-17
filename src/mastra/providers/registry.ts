import { xai } from '@ai-sdk/xai';
import { type ModelRole, defaultModelRoles, type ModelRoleConfig } from './model-roles';

/**
 * Provider registry that manages model selection by logical role.
 * Keeps provider-specific details isolated from business logic.
 */
export class ProviderRegistry {
  private config: ModelRoleConfig;

  constructor(config: ModelRoleConfig = defaultModelRoles) {
    this.config = config;
  }

  /**
   * Get the model for a given role.
   * Returns AI SDK compatible model instance.
   */
  getModel(role: ModelRole) {
    const { provider, modelId } = this.config[role];

    switch (provider) {
      case 'xai':
        return xai(modelId);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get model info without instantiating.
   */
  getModelInfo(role: ModelRole) {
    return this.config[role];
  }

  /**
   * Update a role's model configuration.
   */
  setModel(role: ModelRole, provider: string, modelId: string) {
    this.config[role] = { provider, modelId };
  }

  /**
   * Snapshot current config for tracing.
   */
  snapshot(): ModelRoleConfig {
    return { ...this.config };
  }
}

// Singleton instance
let registry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
  }
  return registry;
}
