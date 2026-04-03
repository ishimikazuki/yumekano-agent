import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { PhaseGraph, PhaseGraphVersion, PhaseGraphVersionSchema } from '../schemas';

/**
 * Repository for phase graph operations.
 */
export const phaseGraphRepo = {
  /**
   * Create a new phase graph version.
   */
  async create(input: {
    characterId: string;
    graph: PhaseGraph;
  }): Promise<PhaseGraphVersion> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    // Get next version number
    const versionResult = await db.execute({
      sql: `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM phase_graph_versions WHERE character_id = ?`,
      args: [input.characterId],
    });
    const versionNumber = versionResult.rows[0].next_version as number;

    await db.execute({
      sql: `INSERT INTO phase_graph_versions (id, character_id, version_number, graph_json, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, input.characterId, versionNumber, JSON.stringify(input.graph), now],
    });

    return PhaseGraphVersionSchema.parse({
      id,
      characterId: input.characterId,
      versionNumber,
      graph: input.graph,
      createdAt: now,
    });
  },

  /**
   * Get phase graph version by ID.
   */
  async getById(id: string): Promise<PhaseGraphVersion | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM phase_graph_versions WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return PhaseGraphVersionSchema.parse({
      id: row.id,
      characterId: row.character_id,
      versionNumber: row.version_number,
      graph: JSON.parse(row.graph_json as string),
      createdAt: row.created_at,
    });
  },

  /**
   * Get latest version for character.
   */
  async getLatest(characterId: string): Promise<PhaseGraphVersion | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM phase_graph_versions WHERE character_id = ? ORDER BY version_number DESC LIMIT 1`,
      args: [characterId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return PhaseGraphVersionSchema.parse({
      id: row.id,
      characterId: row.character_id,
      versionNumber: row.version_number,
      graph: JSON.parse(row.graph_json as string),
      createdAt: row.created_at,
    });
  },

  /**
   * List versions for character.
   */
  async list(characterId: string): Promise<PhaseGraphVersion[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM phase_graph_versions WHERE character_id = ? ORDER BY version_number DESC`,
      args: [characterId],
    });

    return result.rows.map((row) =>
      PhaseGraphVersionSchema.parse({
        id: row.id,
        characterId: row.character_id,
        versionNumber: row.version_number,
        graph: JSON.parse(row.graph_json as string),
        createdAt: row.created_at,
      })
    );
  },
};
