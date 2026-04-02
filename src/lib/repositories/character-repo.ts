import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { normalizeRuntimePersona } from '../persona';
import {
  normalizeLegacyAutonomy,
  normalizeLegacyEmotion,
  normalizeLegacyStyle,
} from './legacy-config-normalization';
import {
  Character,
  CharacterSchema,
  CharacterVersion,
  CharacterVersionSchema,
  CharacterVersionStatus,
  PersonaSpec,
  StyleSpec,
  AutonomySpec,
  EmotionSpec,
  MemoryPolicySpec,
  RuntimePersona,
} from '../schemas';

function parseCharacterVersionRow(row: Record<string, unknown>): CharacterVersion {
  return CharacterVersionSchema.parse({
    id: row.id,
    characterId: row.character_id,
    versionNumber: row.version_number,
    label: row.label ? String(row.label) : undefined,
    status: row.status,
    persona: normalizeRuntimePersona(JSON.parse(row.persona_json as string)),
    style: normalizeLegacyStyle(JSON.parse(row.style_json as string)),
    autonomy: normalizeLegacyAutonomy(JSON.parse(row.autonomy_json as string)),
    emotion: normalizeLegacyEmotion(JSON.parse(row.emotion_json as string)),
    memory: JSON.parse(row.memory_policy_json as string),
    phaseGraphVersionId: row.phase_graph_version_id,
    promptBundleVersionId: row.prompt_bundle_version_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    parentVersionId: row.parent_version_id as string | null,
  });
}

/**
 * Repository for character and character version operations.
 */
export const characterRepo = {
  /**
   * Create a new character.
   */
  async create(input: { slug: string; displayName: string }): Promise<Character> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO characters (id, slug, display_name, created_at) VALUES (?, ?, ?, ?)`,
      args: [id, input.slug, input.displayName, now],
    });

    return CharacterSchema.parse({
      id,
      slug: input.slug,
      displayName: input.displayName,
      createdAt: now,
    });
  },

  /**
   * Get character by ID.
   */
  async getById(id: string): Promise<Character | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT id, slug, display_name, created_at FROM characters WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return CharacterSchema.parse({
      id: row.id,
      slug: row.slug,
      displayName: row.display_name,
      createdAt: row.created_at,
    });
  },

  /**
   * Get character by slug.
   */
  async getBySlug(slug: string): Promise<Character | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT id, slug, display_name, created_at FROM characters WHERE slug = ?`,
      args: [slug],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return CharacterSchema.parse({
      id: row.id,
      slug: row.slug,
      displayName: row.display_name,
      createdAt: row.created_at,
    });
  },

  /**
   * List all characters.
   */
  async list(): Promise<Character[]> {
    const db = getDb();
    const result = await db.execute(
      `SELECT id, slug, display_name, created_at FROM characters ORDER BY created_at DESC`
    );

    return result.rows.map((row) =>
      CharacterSchema.parse({
        id: row.id,
        slug: row.slug,
        displayName: row.display_name,
        createdAt: row.created_at,
      })
    );
  },

  /**
   * Create a new character version.
   */
  async createVersion(input: {
    characterId: string;
    persona: RuntimePersona;
    style: StyleSpec;
    autonomy: AutonomySpec;
    emotion: EmotionSpec;
    memory: MemoryPolicySpec;
    phaseGraphVersionId: string;
    promptBundleVersionId: string;
    createdBy: string;
    status?: CharacterVersionStatus;
    label?: string;
    parentVersionId?: string | null;
  }): Promise<CharacterVersion> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    // Get next version number
    const versionResult = await db.execute({
      sql: `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM character_versions WHERE character_id = ?`,
      args: [input.characterId],
    });
    const versionNumber = versionResult.rows[0].next_version as number;

    await db.execute({
      sql: `INSERT INTO character_versions
            (id, character_id, version_number, label, status, persona_json, style_json, autonomy_json, emotion_json, memory_policy_json, phase_graph_version_id, prompt_bundle_version_id, created_by, created_at, parent_version_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.characterId,
        versionNumber,
        input.label ?? null,
        input.status ?? 'draft',
        JSON.stringify(input.persona),
        JSON.stringify(input.style),
        JSON.stringify(input.autonomy),
        JSON.stringify(input.emotion),
        JSON.stringify(input.memory),
        input.phaseGraphVersionId,
        input.promptBundleVersionId,
        input.createdBy,
        now,
        input.parentVersionId ?? null,
      ],
    });

    return CharacterVersionSchema.parse({
      id,
      characterId: input.characterId,
      versionNumber,
      label: input.label,
      status: input.status ?? 'draft',
      persona: input.persona,
      style: input.style,
      autonomy: input.autonomy,
      emotion: input.emotion,
      memory: input.memory,
      phaseGraphVersionId: input.phaseGraphVersionId,
      promptBundleVersionId: input.promptBundleVersionId,
      createdBy: input.createdBy,
      createdAt: now,
      parentVersionId: input.parentVersionId ?? null,
    });
  },

  /**
   * Get character version by ID.
   */
  async getVersionById(id: string): Promise<CharacterVersion | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM character_versions WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    return parseCharacterVersionRow(result.rows[0] as Record<string, unknown>);
  },

  /**
   * Get latest published version for a character.
   */
  async getLatestPublished(characterId: string): Promise<CharacterVersion | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM character_versions
            WHERE character_id = ? AND status = 'published'
            ORDER BY version_number DESC LIMIT 1`,
      args: [characterId],
    });

    if (result.rows.length === 0) return null;

    return parseCharacterVersionRow(result.rows[0] as Record<string, unknown>);
  },

  /**
   * Update version status.
   */
  async updateVersionStatus(id: string, status: CharacterVersionStatus): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE character_versions SET status = ? WHERE id = ?`,
      args: [status, id],
    });
  },

  /**
   * Update the stored runtime persona for a character version.
   */
  async updateVersionPersona(id: string, persona: RuntimePersona): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE character_versions SET persona_json = ? WHERE id = ?`,
      args: [JSON.stringify(persona), id],
    });
  },

  /**
   * Archive all other published versions for a character.
   */
  async archivePublishedVersionsExcept(characterId: string, keepVersionId: string): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE character_versions
            SET status = 'archived'
            WHERE character_id = ? AND id != ? AND status = 'published'`,
      args: [characterId, keepVersionId],
    });
  },

  /**
   * Update the character display name.
   */
  async updateDisplayName(id: string, displayName: string): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE characters SET display_name = ? WHERE id = ?`,
      args: [displayName, id],
    });
  },

  /**
   * List versions for a character.
   */
  async listVersions(characterId: string): Promise<CharacterVersion[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM character_versions WHERE character_id = ? ORDER BY version_number DESC`,
      args: [characterId],
    });

    return result.rows.map((row) =>
      parseCharacterVersionRow(row as Record<string, unknown>)
    );
  },
};
