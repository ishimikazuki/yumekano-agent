import { Mastra } from '@mastra/core';
import { getProviderRegistry } from './providers/registry';

/**
 * Initialize and export Mastra instance.
 * This is the main entry point for all Mastra operations.
 */
export const mastra = new Mastra({});

// Re-export provider registry for convenience
export { getProviderRegistry };
export type { ModelRole } from './providers/model-roles';
