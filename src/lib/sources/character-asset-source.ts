/**
 * Character asset source abstraction.
 *
 * This allows the runtime to load character assets from either:
 * - Published releases (for production)
 * - Draft workspaces (for playground testing)
 */

import type {
  PhaseGraph,
  PersonaAuthoring,
  StyleSpec,
  AutonomySpec,
  EmotionSpec,
  MemoryPolicySpec,
  CharacterIdentity,
  PromptBundleContent,
} from '../schemas';

/**
 * Loaded character assets for runtime use.
 */
export interface CharacterAssets {
  // Source info
  sourceType: 'published' | 'draft';
  sourceId: string; // versionId or workspaceId

  // Identity
  characterId: string;
  identity: CharacterIdentity;

  // Configuration
  persona: PersonaAuthoring;
  style: StyleSpec;
  autonomy: AutonomySpec;
  emotion: EmotionSpec;
  memory: MemoryPolicySpec;

  // Phase graph
  phaseGraph: PhaseGraph;
  entryPhaseId: string;

  // Prompts
  prompts: PromptBundleContent;
}

/**
 * Interface for loading character assets.
 */
export interface CharacterAssetSource {
  /**
   * Load character assets for runtime use.
   */
  load(): Promise<CharacterAssets>;

  /**
   * Get source type identifier.
   */
  getSourceType(): 'published' | 'draft';

  /**
   * Get source identifier (version ID or workspace ID).
   */
  getSourceId(): string;
}

/**
 * Factory for creating asset sources.
 */
export interface CharacterAssetSourceFactory {
  /**
   * Create a published source for a character.
   */
  createPublishedSource(characterId: string, channel?: 'prod'): Promise<CharacterAssetSource | null>;

  /**
   * Create a draft source for a workspace.
   */
  createDraftSource(workspaceId: string): Promise<CharacterAssetSource | null>;
}
