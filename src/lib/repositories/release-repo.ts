import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { Release, ReleaseSchema, ReleaseChannel } from '../schemas';

/**
 * Repository for release operations.
 */
export const releaseRepo = {
  /**
   * Create a new release.
   */
  async create(input: {
    characterId: string;
    characterVersionId: string;
    channel?: ReleaseChannel;
    publishedBy: string;
    rollbackOfReleaseId?: string | null;
  }): Promise<Release> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO releases
            (id, character_id, character_version_id, channel, published_by, published_at, rollback_of_release_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.characterId,
        input.characterVersionId,
        input.channel ?? 'prod',
        input.publishedBy,
        now,
        input.rollbackOfReleaseId ?? null,
      ],
    });

    return ReleaseSchema.parse({
      id,
      characterId: input.characterId,
      characterVersionId: input.characterVersionId,
      channel: input.channel ?? 'prod',
      publishedBy: input.publishedBy,
      publishedAt: now,
      rollbackOfReleaseId: input.rollbackOfReleaseId ?? null,
    });
  },

  /**
   * Get release by ID.
   */
  async getById(id: string): Promise<Release | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM releases WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return ReleaseSchema.parse({
      id: row.id,
      characterId: row.character_id,
      characterVersionId: row.character_version_id,
      channel: row.channel,
      publishedBy: row.published_by,
      publishedAt: row.published_at,
      rollbackOfReleaseId: row.rollback_of_release_id,
    });
  },

  /**
   * Get current release for character and channel.
   */
  async getCurrent(characterId: string, channel: ReleaseChannel = 'prod'): Promise<Release | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM releases
            WHERE character_id = ? AND channel = ?
            ORDER BY published_at DESC LIMIT 1`,
      args: [characterId, channel],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return ReleaseSchema.parse({
      id: row.id,
      characterId: row.character_id,
      characterVersionId: row.character_version_id,
      channel: row.channel,
      publishedBy: row.published_by,
      publishedAt: row.published_at,
      rollbackOfReleaseId: row.rollback_of_release_id,
    });
  },

  /**
   * List releases for character.
   */
  async listByCharacter(characterId: string, limit = 20): Promise<Release[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM releases WHERE character_id = ? ORDER BY published_at DESC LIMIT ?`,
      args: [characterId, limit],
    });

    return result.rows.map((row) =>
      ReleaseSchema.parse({
        id: row.id,
        characterId: row.character_id,
        characterVersionId: row.character_version_id,
        channel: row.channel,
        publishedBy: row.published_by,
        publishedAt: row.published_at,
        rollbackOfReleaseId: row.rollback_of_release_id,
      })
    );
  },

  /**
   * Create a rollback release.
   */
  async createRollback(input: {
    characterId: string;
    characterVersionId: string;
    publishedBy: string;
    rollbackOfReleaseId: string;
  }): Promise<Release> {
    return this.create({
      characterId: input.characterId,
      characterVersionId: input.characterVersionId,
      publishedBy: input.publishedBy,
      rollbackOfReleaseId: input.rollbackOfReleaseId,
    });
  },

  /**
   * Get previous release (for rollback).
   */
  async getPrevious(characterId: string, currentReleaseId: string, channel: ReleaseChannel = 'prod'): Promise<Release | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM releases
            WHERE character_id = ? AND channel = ? AND id != ?
            ORDER BY published_at DESC LIMIT 1`,
      args: [characterId, channel, currentReleaseId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return ReleaseSchema.parse({
      id: row.id,
      characterId: row.character_id,
      characterVersionId: row.character_version_id,
      channel: row.channel,
      publishedBy: row.published_by,
      publishedAt: row.published_at,
      rollbackOfReleaseId: row.rollback_of_release_id,
    });
  },
};
