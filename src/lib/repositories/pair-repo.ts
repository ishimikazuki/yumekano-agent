import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { Pair, PairSchema, PairState, PairStateSchema, PADState, AppraisalVector } from '../schemas';
import { createRuntimeEmotionState } from '../rules/pad';

/**
 * Default PAD state (neutral baseline).
 */
const defaultPAD: PADState = {
  pleasure: 0,
  arousal: 0,
  dominance: 0,
};

/**
 * Default appraisal vector (neutral).
 */
const defaultAppraisal: AppraisalVector = {
  goalCongruence: 0,
  controllability: 0.5,
  certainty: 0.5,
  normAlignment: 0,
  attachmentSecurity: 0.5,
  reciprocity: 0,
  pressureIntrusiveness: 0,
  novelty: 0.5,
  selfRelevance: 0.5,
};

/**
 * Repository for pair and pair state operations.
 */
export const pairRepo = {
  /**
   * Create a new pair.
   */
  async create(input: {
    userId: string;
    characterId: string;
    canonicalThreadId?: string;
  }): Promise<Pair> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();
    const threadId = input.canonicalThreadId ?? `thread_${uuid()}`;

    await db.execute({
      sql: `INSERT INTO pairs (id, user_id, character_id, canonical_thread_id, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, input.userId, input.characterId, threadId, now],
    });

    return PairSchema.parse({
      id,
      userId: input.userId,
      characterId: input.characterId,
      canonicalThreadId: threadId,
      createdAt: now,
    });
  },

  /**
   * Get pair by ID.
   */
  async getById(id: string): Promise<Pair | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM pairs WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return PairSchema.parse({
      id: row.id,
      userId: row.user_id,
      characterId: row.character_id,
      canonicalThreadId: row.canonical_thread_id,
      createdAt: row.created_at,
    });
  },

  /**
   * Get pair by user and character.
   */
  async getByUserAndCharacter(userId: string, characterId: string): Promise<Pair | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM pairs WHERE user_id = ? AND character_id = ?`,
      args: [userId, characterId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return PairSchema.parse({
      id: row.id,
      userId: row.user_id,
      characterId: row.character_id,
      canonicalThreadId: row.canonical_thread_id,
      createdAt: row.created_at,
    });
  },

  /**
   * Get or create pair.
   */
  async getOrCreate(input: { userId: string; characterId: string }): Promise<Pair> {
    const existing = await this.getByUserAndCharacter(input.userId, input.characterId);
    if (existing) return existing;
    return this.create(input);
  },

  /**
   * Initialize pair state.
   */
  async initState(input: {
    pairId: string;
    activeCharacterVersionId: string;
    activePhaseId: string;
    pad?: PADState;
  }): Promise<PairState> {
    const db = getDb();
    const now = new Date().toISOString();
    const pad = input.pad ?? defaultPAD;
    const emotion = createRuntimeEmotionState(pad, new Date(now));

    await db.execute({
      sql: `INSERT INTO pair_state
            (pair_id, active_character_version_id, active_phase_id, affinity, trust, intimacy_readiness, conflict, pad_json, pad_fast_json, pad_slow_json, pad_combined_json, last_emotion_updated_at, appraisal_json, open_thread_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.pairId,
        input.activeCharacterVersionId,
        input.activePhaseId,
        50, // default affinity
        50, // default trust
        0, // default intimacy readiness
        0, // default conflict
        JSON.stringify(pad),
        JSON.stringify(emotion.fastAffect),
        JSON.stringify(emotion.slowMood),
        JSON.stringify(emotion.combined),
        emotion.lastUpdatedAt.toISOString(),
        JSON.stringify(defaultAppraisal),
        0,
        now,
      ],
    });

    return PairStateSchema.parse({
      pairId: input.pairId,
      activeCharacterVersionId: input.activeCharacterVersionId,
      activePhaseId: input.activePhaseId,
      affinity: 50,
      trust: 50,
      intimacyReadiness: 0,
      conflict: 0,
      emotion,
      pad,
      appraisal: defaultAppraisal,
      openThreadCount: 0,
      lastTransitionAt: null,
      updatedAt: now,
    });
  },

  /**
   * Get pair state.
   */
  async getState(pairId: string): Promise<PairState | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM pair_state WHERE pair_id = ?`,
      args: [pairId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const combined = JSON.parse(String(row.pad_combined_json ?? row.pad_json));
    const emotion = {
      fastAffect: JSON.parse(String(row.pad_fast_json ?? row.pad_json)),
      slowMood: JSON.parse(String(row.pad_slow_json ?? row.pad_json)),
      combined,
      lastUpdatedAt: row.last_emotion_updated_at ?? row.updated_at,
    };
    return PairStateSchema.parse({
      pairId: row.pair_id,
      activeCharacterVersionId: row.active_character_version_id,
      activePhaseId: row.active_phase_id,
      affinity: row.affinity,
      trust: row.trust,
      intimacyReadiness: row.intimacy_readiness,
      conflict: row.conflict,
      emotion,
      pad: combined,
      appraisal: JSON.parse(row.appraisal_json as string),
      openThreadCount: row.open_thread_count,
      lastTransitionAt: row.last_transition_at,
      updatedAt: row.updated_at,
    });
  },

  /**
   * Update pair state.
   */
  async updateState(
    pairId: string,
    updates: Partial<{
      activeCharacterVersionId: string;
      activePhaseId: string;
      affinity: number;
      trust: number;
      intimacyReadiness: number;
      conflict: number;
      emotion: PairState['emotion'];
      pad: PADState;
      appraisal: AppraisalVector;
      openThreadCount: number;
      lastTransitionAt: Date | null;
    }>
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    const sets: string[] = ['updated_at = ?'];
    const args: (string | number | null)[] = [now];

    if (updates.activeCharacterVersionId !== undefined) {
      sets.push('active_character_version_id = ?');
      args.push(updates.activeCharacterVersionId);
    }
    if (updates.activePhaseId !== undefined) {
      sets.push('active_phase_id = ?');
      args.push(updates.activePhaseId);
    }
    if (updates.affinity !== undefined) {
      sets.push('affinity = ?');
      args.push(updates.affinity);
    }
    if (updates.trust !== undefined) {
      sets.push('trust = ?');
      args.push(updates.trust);
    }
    if (updates.intimacyReadiness !== undefined) {
      sets.push('intimacy_readiness = ?');
      args.push(updates.intimacyReadiness);
    }
    if (updates.conflict !== undefined) {
      sets.push('conflict = ?');
      args.push(updates.conflict);
    }
    if (updates.emotion !== undefined) {
      sets.push('pad_fast_json = ?');
      args.push(JSON.stringify(updates.emotion.fastAffect));
      sets.push('pad_slow_json = ?');
      args.push(JSON.stringify(updates.emotion.slowMood));
      sets.push('pad_combined_json = ?');
      args.push(JSON.stringify(updates.emotion.combined));
      sets.push('last_emotion_updated_at = ?');
      args.push(updates.emotion.lastUpdatedAt.toISOString());
      sets.push('pad_json = ?');
      args.push(JSON.stringify(updates.emotion.combined));
    }
    if (updates.pad !== undefined) {
      sets.push('pad_json = ?');
      args.push(JSON.stringify(updates.pad));
    }
    if (updates.appraisal !== undefined) {
      sets.push('appraisal_json = ?');
      args.push(JSON.stringify(updates.appraisal));
    }
    if (updates.openThreadCount !== undefined) {
      sets.push('open_thread_count = ?');
      args.push(updates.openThreadCount);
    }
    if (updates.lastTransitionAt !== undefined) {
      sets.push('last_transition_at = ?');
      args.push(updates.lastTransitionAt?.toISOString() ?? null);
    }

    args.push(pairId);

    await db.execute({
      sql: `UPDATE pair_state SET ${sets.join(', ')} WHERE pair_id = ?`,
      args,
    });
  },
};
