import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { PromptBundleVersion, PromptBundleVersionSchema } from '../schemas';

/**
 * Repository for prompt bundle operations.
 */
export const promptBundleRepo = {
  /**
   * Create a new prompt bundle version.
   */
  async create(input: {
    characterId: string;
    plannerMd: string;
    generatorMd: string;
    extractorMd: string;
    reflectorMd: string;
    rankerMd: string;
  }): Promise<PromptBundleVersion> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    // Get next version number
    const versionResult = await db.execute({
      sql: `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM prompt_bundle_versions WHERE character_id = ?`,
      args: [input.characterId],
    });
    const versionNumber = versionResult.rows[0].next_version as number;

    await db.execute({
      sql: `INSERT INTO prompt_bundle_versions (id, character_id, version_number, planner_md, generator_md, extractor_md, reflector_md, ranker_md, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.characterId,
        versionNumber,
        input.plannerMd,
        input.generatorMd,
        input.extractorMd,
        input.reflectorMd,
        input.rankerMd,
        now,
      ],
    });

    return PromptBundleVersionSchema.parse({
      id,
      characterId: input.characterId,
      versionNumber,
      plannerMd: input.plannerMd,
      generatorMd: input.generatorMd,
      extractorMd: input.extractorMd,
      reflectorMd: input.reflectorMd,
      rankerMd: input.rankerMd,
      createdAt: now,
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
    return PromptBundleVersionSchema.parse({
      id: row.id,
      characterId: row.character_id,
      versionNumber: row.version_number,
      plannerMd: row.planner_md,
      generatorMd: row.generator_md,
      extractorMd: row.extractor_md,
      reflectorMd: row.reflector_md,
      rankerMd: row.ranker_md,
      createdAt: row.created_at,
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
    return PromptBundleVersionSchema.parse({
      id: row.id,
      characterId: row.character_id,
      versionNumber: row.version_number,
      plannerMd: row.planner_md,
      generatorMd: row.generator_md,
      extractorMd: row.extractor_md,
      reflectorMd: row.reflector_md,
      rankerMd: row.ranker_md,
      createdAt: row.created_at,
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
      PromptBundleVersionSchema.parse({
        id: row.id,
        characterId: row.character_id,
        versionNumber: row.version_number,
        plannerMd: row.planner_md,
        generatorMd: row.generator_md,
        extractorMd: row.extractor_md,
        reflectorMd: row.reflector_md,
        rankerMd: row.ranker_md,
        createdAt: row.created_at,
      })
    );
  },
};
