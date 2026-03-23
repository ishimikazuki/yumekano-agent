/**
 * Published asset source - loads from immutable release artifacts.
 */

import {
  characterRepo,
  releaseRepo,
  phaseGraphRepo,
  promptBundleRepo,
} from '../repositories';
import { toPersonaAuthoring } from '../persona';
import type { CharacterAssets, CharacterAssetSource } from './character-asset-source';

export class PublishedAssetSource implements CharacterAssetSource {
  private characterId: string;
  private channel: 'prod';
  private versionId: string | null = null;

  constructor(characterId: string, channel: 'prod' = 'prod') {
    this.characterId = characterId;
    this.channel = channel;
  }

  getSourceType(): 'published' {
    return 'published';
  }

  getSourceId(): string {
    if (!this.versionId) {
      throw new Error('Source not loaded yet');
    }
    return this.versionId;
  }

  async load(): Promise<CharacterAssets> {
    // Get current release
    const release = await releaseRepo.getCurrent(this.characterId, this.channel);
    if (!release) {
      throw new Error(`No published release for character ${this.characterId}`);
    }

    // Get character version
    const version = await characterRepo.getVersionById(release.characterVersionId);
    if (!version) {
      throw new Error(`Character version ${release.characterVersionId} not found`);
    }

    this.versionId = version.id;

    // Get character info
    const character = await characterRepo.getById(this.characterId);
    if (!character) {
      throw new Error(`Character ${this.characterId} not found`);
    }

    // Get phase graph
    const phaseGraphVersion = await phaseGraphRepo.getById(version.phaseGraphVersionId);
    if (!phaseGraphVersion) {
      throw new Error(`Phase graph ${version.phaseGraphVersionId} not found`);
    }

    // Get prompt bundle
    const promptBundle = await promptBundleRepo.getById(version.promptBundleVersionId);
    if (!promptBundle) {
      throw new Error(`Prompt bundle ${version.promptBundleVersionId} not found`);
    }

    return {
      sourceType: 'published',
      sourceId: version.id,
      characterId: this.characterId,

      // Identity - derive from character + version
      identity: {
        displayName: character.displayName,
        firstPerson: 'わたし', // Default for published versions without explicit identity
        secondPerson: '○○さん',
      },

      // Configuration
      persona: toPersonaAuthoring(version.persona),
      style: version.style,
      autonomy: version.autonomy,
      emotion: version.emotion,
      memory: version.memory,

      // Phase graph
      phaseGraph: phaseGraphVersion.graph,
      entryPhaseId: phaseGraphVersion.graph.entryPhaseId,

      // Prompts
      prompts: {
        plannerMd: promptBundle.plannerMd,
        generatorMd: promptBundle.generatorMd,
        generatorIntimacyMd: promptBundle.generatorIntimacyMd,
        extractorMd: promptBundle.extractorMd,
        reflectorMd: promptBundle.reflectorMd,
        rankerMd: promptBundle.rankerMd,
      },
    };
  }
}

/**
 * Create a published source for a character.
 * Returns null if no release exists.
 */
export async function createPublishedSource(
  characterId: string,
  channel: 'prod' = 'prod'
): Promise<PublishedAssetSource | null> {
  const release = await releaseRepo.getCurrent(characterId, channel);
  if (!release) {
    return null;
  }
  return new PublishedAssetSource(characterId, channel);
}
