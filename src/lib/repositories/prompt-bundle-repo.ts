import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import {
  PromptBundleVersion,
  type PromptBundleContent,
  buildPromptBundleContent,
  buildPromptBundleVersion,
} from '../schemas';

/**
 * Repository for prompt bundle operations.
 */
export const promptBundleRepo = {
  /**
   * Create a new prompt bundle version.
   */
  async create(input: {
    characterId: string;
    prompts: Partial<PromptBundleContent>;
  }): Promise<PromptBundleVersion> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();
    const prompts = buildPromptBundleContent(input.prompts);

    // Get next version number
    const versionResult = await db.execute({
      sql: `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM prompt_bundle_versions WHERE character_id = ?`,
      args: [input.characterId],
    });
    const versionNumber = versionResult.rows[0].next_version as number;

    await db.execute({
      sql: `INSERT INTO prompt_bundle_versions (id, character_id, version_number, planner_md, generator_md, generator_intimacy_md, emotion_appraiser_md, extractor_md, reflector_md, ranker_md, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.characterId,
        versionNumber,
        prompts.plannerMd,
        prompts.generatorMd,
        prompts.generatorIntimacyMd,
        prompts.emotionAppraiserMd,
        prompts.extractorMd,
        prompts.reflectorMd,
        prompts.rankerMd,
        now,
      ],
    });

    return buildPromptBundleVersion({
      id,
      characterId: input.characterId,
      versionNumber,
      createdAt: now,
      prompts,
    });
  },

  /**
   * Get prompt bundle version by ID.
   */
  async getById(id: string): Promise<PromptBundleVersion | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM prompt_bundle_versions WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return buildPromptBundleVersion({
      id: String(row.id),
      characterId: String(row.character_id),
      versionNumber: Number(row.version_number),
      createdAt: String(row.created_at),
      prompts: {
        plannerMd: row.planner_md as string,
        generatorMd: row.generator_md as string,
        generatorIntimacyMd: row.generator_intimacy_md as string | undefined,
        emotionAppraiserMd: row.emotion_appraiser_md as string | undefined,
        extractorMd: row.extractor_md as string,
        reflectorMd: row.reflector_md as string,
        rankerMd: row.ranker_md as string,
      },
    });
  },

  /**
   * Get latest version for character.
   */
  async getLatest(characterId: string): Promise<PromptBundleVersion | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM prompt_bundle_versions WHERE character_id = ? ORDER BY version_number DESC LIMIT 1`,
      args: [characterId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return buildPromptBundleVersion({
      id: String(row.id),
      characterId: String(row.character_id),
      versionNumber: Number(row.version_number),
      createdAt: String(row.created_at),
      prompts: {
        plannerMd: row.planner_md as string,
        generatorMd: row.generator_md as string,
        generatorIntimacyMd: row.generator_intimacy_md as string | undefined,
        emotionAppraiserMd: row.emotion_appraiser_md as string | undefined,
        extractorMd: row.extractor_md as string,
        reflectorMd: row.reflector_md as string,
        rankerMd: row.ranker_md as string,
      },
    });
  },

  /**
   * List versions for character.
   */
  async list(characterId: string): Promise<PromptBundleVersion[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM prompt_bundle_versions WHERE character_id = ? ORDER BY version_number DESC`,
      args: [characterId],
    });

    return result.rows.map((row) =>
      buildPromptBundleVersion({
        id: String(row.id),
        characterId: String(row.character_id),
        versionNumber: Number(row.version_number),
        createdAt: String(row.created_at),
        prompts: {
          plannerMd: row.planner_md as string,
          generatorMd: row.generator_md as string,
          generatorIntimacyMd: row.generator_intimacy_md as string | undefined,
          emotionAppraiserMd: row.emotion_appraiser_md as string | undefined,
          extractorMd: row.extractor_md as string,
          reflectorMd: row.reflector_md as string,
          rankerMd: row.ranker_md as string,
        },
      })
    );
  },
};
