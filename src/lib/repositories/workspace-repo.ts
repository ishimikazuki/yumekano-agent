import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { normalizePersonaAuthoring } from '../persona';
import {
  asNumber,
  normalizeLegacyAutonomy,
  normalizeLegacyEmotion,
  normalizeLegacyStyle,
} from './legacy-config-normalization';
import { serializeDraftStateForStorage } from '../workspaces/draft-persistence';
import {
  Workspace,
  WorkspaceSchema,
  DraftState,
  DraftStateSchema,
  WorkspaceWithDraft,
  Autosave,
  AutosaveSchema,
  PlaygroundSession,
  PlaygroundSessionSchema,
  SandboxPairState,
  SandboxPairStateSchema,
  PlaygroundTurn,
  PlaygroundTurnSchema,
  EditorContext,
  EditorContextSchema,
  PromptBundleContentSchema,
  buildPromptBundleContent,
  WorkingMemory,
  WorkingMemorySchema,
  MemoryEvent,
  MemoryEventSchema,
  MemoryFact,
  MemoryFactSchema,
  MemoryFactStatus,
  MemoryObservation,
  MemoryObservationSchema,
  OpenThread,
  OpenThreadSchema,
  MemoryUsage,
  MemoryUsageSchema,
  PADState,
  PromptBundleKey,
} from '../schemas';

const NEUTRAL_APPRAISAL = {
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

const DEFAULT_WORKING_MEMORY: WorkingMemory = {
  preferredAddressForm: null,
  knownLikes: [],
  knownDislikes: [],
  currentCooldowns: {},
  activeTensionSummary: null,
  relationshipStance: null,
  knownCorrections: [],
  intimacyContextHints: [],
};

function parseSandboxEventRow(row: Record<string, unknown>): MemoryEvent {
  return MemoryEventSchema.parse({
    id: row.id,
    pairId: row.session_id,
    sourceTurnId: row.source_turn_id,
    eventType: row.event_type,
    summary: row.summary,
    salience: row.salience,
    retrievalKeys: JSON.parse(String(row.retrieval_keys_json)),
    emotionSignature: row.emotion_signature_json
      ? JSON.parse(String(row.emotion_signature_json))
      : null,
    participants: JSON.parse(String(row.participants_json)),
    qualityScore: row.quality_score,
    supersedesEventId: row.supersedes_event_id,
    createdAt: row.created_at,
  });
}

function parseSandboxFactRow(row: Record<string, unknown>): MemoryFact {
  return MemoryFactSchema.parse({
    id: row.id,
    pairId: row.session_id,
    subject: row.subject,
    predicate: row.predicate,
    object: JSON.parse(String(row.object_json)),
    confidence: row.confidence,
    status: row.status,
    supersedesFactId: row.supersedes_fact_id,
    sourceEventId: row.source_event_id,
    createdAt: row.created_at,
  });
}

function parseSandboxObservationRow(row: Record<string, unknown>): MemoryObservation {
  return MemoryObservationSchema.parse({
    id: row.id,
    pairId: row.session_id,
    summary: row.summary,
    retrievalKeys: JSON.parse(String(row.retrieval_keys_json)),
    salience: row.salience,
    qualityScore: row.quality_score,
    windowStartAt: row.window_start_at,
    windowEndAt: row.window_end_at,
    createdAt: row.created_at,
  });
}

function parseSandboxThreadRow(row: Record<string, unknown>): OpenThread {
  return OpenThreadSchema.parse({
    id: row.id,
    pairId: row.session_id,
    key: row.key,
    summary: row.summary,
    severity: row.severity,
    status: row.status,
    openedByEventId: row.opened_by_event_id,
    resolvedByEventId: row.resolved_by_event_id,
    updatedAt: row.updated_at,
  });
}

function parsePlaygroundSessionRow(row: Record<string, unknown>): PlaygroundSession {
  return PlaygroundSessionSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    isSandbox: Boolean(row.is_sandbox),
    createdAt: row.created_at,
  });
}

async function deleteSessionData(sessionId: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: `DELETE FROM sandbox_memory_usage WHERE session_id = ?`, args: [sessionId] });
  await db.execute({
    sql: `DELETE FROM sandbox_memory_open_threads WHERE session_id = ?`,
    args: [sessionId],
  });
  await db.execute({
    sql: `DELETE FROM sandbox_memory_observations WHERE session_id = ?`,
    args: [sessionId],
  });
  await db.execute({ sql: `DELETE FROM sandbox_memory_facts WHERE session_id = ?`, args: [sessionId] });
  await db.execute({ sql: `DELETE FROM sandbox_memory_events WHERE session_id = ?`, args: [sessionId] });
  await db.execute({ sql: `DELETE FROM sandbox_working_memory WHERE session_id = ?`, args: [sessionId] });
  await db.execute({ sql: `DELETE FROM sandbox_pair_state WHERE session_id = ?`, args: [sessionId] });
  await db.execute({ sql: `DELETE FROM playground_turns WHERE session_id = ?`, args: [sessionId] });
  await db.execute({ sql: `DELETE FROM playground_sessions WHERE id = ?`, args: [sessionId] });
}

/**
 * Repository for workspace and draft operations.
 */
export const workspaceRepo = {
  // ==========================================
  // Workspace CRUD
  // ==========================================

  /**
   * Create a new workspace for a character.
   */
  async create(input: {
    characterId: string;
    name: string;
    createdBy: string;
  }): Promise<Workspace> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO character_workspaces (id, character_id, name, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, input.characterId, input.name, input.createdBy, now, now],
    });

    return WorkspaceSchema.parse({
      id,
      characterId: input.characterId,
      name: input.name,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Get workspace by ID.
   */
  async getById(id: string): Promise<Workspace | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM character_workspaces WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return WorkspaceSchema.parse({
      id: row.id,
      characterId: row.character_id,
      name: row.name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  },

  /**
   * List workspaces for a character.
   */
  async listByCharacter(characterId: string): Promise<Workspace[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM character_workspaces WHERE character_id = ? ORDER BY updated_at DESC`,
      args: [characterId],
    });

    return result.rows.map((row) =>
      WorkspaceSchema.parse({
        id: row.id,
        characterId: row.character_id,
        name: row.name,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    );
  },

  /**
   * Delete a workspace.
   */
  async delete(id: string): Promise<void> {
    const db = getDb();
    // Delete related data first
    await db.execute({ sql: `DELETE FROM workspace_editor_context WHERE workspace_id = ?`, args: [id] });
    await db.execute({ sql: `DELETE FROM workspace_autosaves WHERE workspace_id = ?`, args: [id] });
    await db.execute({ sql: `DELETE FROM workspace_draft_state WHERE workspace_id = ?`, args: [id] });
    // Delete playground data
    const sessions = await db.execute({ sql: `SELECT id FROM playground_sessions WHERE workspace_id = ?`, args: [id] });
    for (const session of sessions.rows) {
      await deleteSessionData(String(session.id));
    }
    // Finally delete workspace
    await db.execute({ sql: `DELETE FROM character_workspaces WHERE id = ?`, args: [id] });
  },

  // ==========================================
  // Draft State
  // ==========================================

  /**
   * Initialize draft state for a workspace.
   */
  async initDraft(workspaceId: string, draft: DraftState): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const serialized = serializeDraftStateForStorage(draft);

    await db.execute({
      sql: `INSERT INTO workspace_draft_state
            (workspace_id, identity_json, persona_json, style_json, autonomy_json, emotion_json, memory_policy_json, phase_graph_json, planner_md, generator_md, generator_intimacy_md, emotion_appraiser_md, extractor_md, reflector_md, ranker_md, base_version_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        workspaceId,
        serialized.identityJson,
        serialized.personaJson,
        serialized.styleJson,
        serialized.autonomyJson,
        serialized.emotionJson,
        serialized.memoryPolicyJson,
        serialized.phaseGraphJson,
        serialized.plannerMd,
        serialized.generatorMd,
        serialized.generatorIntimacyMd,
        serialized.emotionAppraiserMd,
        serialized.extractorMd,
        serialized.reflectorMd,
        serialized.rankerMd,
        serialized.baseVersionId,
        now,
      ],
    });

    // Touch workspace updated_at
    await db.execute({
      sql: `UPDATE character_workspaces SET updated_at = ? WHERE id = ?`,
      args: [now, workspaceId],
    });
  },

  /**
   * Replace the full draft state for a workspace.
   */
  async replaceDraft(workspaceId: string, draft: DraftState): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const serialized = serializeDraftStateForStorage(draft);

    await db.execute({
      sql: `UPDATE workspace_draft_state
            SET identity_json = ?, persona_json = ?, style_json = ?, autonomy_json = ?, emotion_json = ?, memory_policy_json = ?, phase_graph_json = ?, planner_md = ?, generator_md = ?, generator_intimacy_md = ?, emotion_appraiser_md = ?, extractor_md = ?, reflector_md = ?, ranker_md = ?, base_version_id = ?, updated_at = ?
            WHERE workspace_id = ?`,
      args: [
        serialized.identityJson,
        serialized.personaJson,
        serialized.styleJson,
        serialized.autonomyJson,
        serialized.emotionJson,
        serialized.memoryPolicyJson,
        serialized.phaseGraphJson,
        serialized.plannerMd,
        serialized.generatorMd,
        serialized.generatorIntimacyMd,
        serialized.emotionAppraiserMd,
        serialized.extractorMd,
        serialized.reflectorMd,
        serialized.rankerMd,
        serialized.baseVersionId,
        now,
        workspaceId,
      ],
    });

    await db.execute({
      sql: `UPDATE character_workspaces SET updated_at = ? WHERE id = ?`,
      args: [now, workspaceId],
    });
  },

  /**
   * Get draft state for a workspace.
   */
  async getDraft(workspaceId: string): Promise<DraftState | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM workspace_draft_state WHERE workspace_id = ?`,
      args: [workspaceId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return DraftStateSchema.parse({
      identity: JSON.parse(row.identity_json as string),
      persona: normalizePersonaAuthoring(JSON.parse(row.persona_json as string)),
      style: normalizeLegacyStyle(JSON.parse(row.style_json as string)),
      autonomy: normalizeLegacyAutonomy(JSON.parse(row.autonomy_json as string)),
      emotion: normalizeLegacyEmotion(JSON.parse(row.emotion_json as string)),
      memory: JSON.parse(row.memory_policy_json as string),
      phaseGraph: JSON.parse(row.phase_graph_json as string),
      prompts: buildPromptBundleContent({
        plannerMd: row.planner_md as string,
        generatorMd: row.generator_md as string,
        generatorIntimacyMd: row.generator_intimacy_md as string | undefined,
        emotionAppraiserMd: row.emotion_appraiser_md as string | undefined,
        extractorMd: row.extractor_md as string,
        reflectorMd: row.reflector_md as string,
        rankerMd: row.ranker_md as string,
      }),
      baseVersionId: row.base_version_id as string | null,
    });
  },

  /**
   * Get workspace with draft state.
   */
  async getWithDraft(workspaceId: string): Promise<WorkspaceWithDraft | null> {
    const workspace = await this.getById(workspaceId);
    if (!workspace) return null;

    const draft = await this.getDraft(workspaceId);
    if (!draft) return null;

    return { ...workspace, draft };
  },

  /**
   * Update a specific section of draft state.
   */
  async updateDraftSection<K extends keyof DraftState>(
    workspaceId: string,
    section: K,
    value: DraftState[K]
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    const columnMap: Record<keyof DraftState, string> = {
      identity: 'identity_json',
      persona: 'persona_json',
      style: 'style_json',
      autonomy: 'autonomy_json',
      emotion: 'emotion_json',
      memory: 'memory_policy_json',
      phaseGraph: 'phase_graph_json',
      prompts: '', // handled separately
      baseVersionId: 'base_version_id',
    };

    if (section === 'prompts') {
      const prompts = PromptBundleContentSchema.parse(value);
      await db.execute({
        sql: `UPDATE workspace_draft_state
              SET planner_md = ?, generator_md = ?, generator_intimacy_md = ?, emotion_appraiser_md = ?, extractor_md = ?, reflector_md = ?, ranker_md = ?, updated_at = ?
              WHERE workspace_id = ?`,
        args: [
          prompts.plannerMd,
          prompts.generatorMd,
          prompts.generatorIntimacyMd,
          prompts.emotionAppraiserMd,
          prompts.extractorMd,
          prompts.reflectorMd,
          prompts.rankerMd,
          now,
          workspaceId,
        ],
      });
    } else if (section === 'baseVersionId') {
      await db.execute({
        sql: `UPDATE workspace_draft_state SET base_version_id = ?, updated_at = ? WHERE workspace_id = ?`,
        args: [value as string | null, now, workspaceId],
      });
    } else {
      const column = columnMap[section];
      const serializedValue =
        section === 'persona'
          ? normalizePersonaAuthoring(value)
          : value;
      await db.execute({
        sql: `UPDATE workspace_draft_state SET ${column} = ?, updated_at = ? WHERE workspace_id = ?`,
        args: [JSON.stringify(serializedValue), now, workspaceId],
      });
    }

    // Touch workspace updated_at
    await db.execute({
      sql: `UPDATE character_workspaces SET updated_at = ? WHERE id = ?`,
      args: [now, workspaceId],
    });
  },

  /**
   * Update a single prompt in the bundle.
   */
  async updatePrompt(
    workspaceId: string,
    promptKey:
      | PromptBundleKey
      | 'planner'
      | 'generator'
      | 'generatorIntimacy'
      | 'emotionAppraiser'
      | 'extractor'
      | 'reflector'
      | 'ranker',
    content: string
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const columnMap = {
      plannerMd: 'planner_md',
      generatorMd: 'generator_md',
      generatorIntimacyMd: 'generator_intimacy_md',
      emotionAppraiserMd: 'emotion_appraiser_md',
      extractorMd: 'extractor_md',
      reflectorMd: 'reflector_md',
      rankerMd: 'ranker_md',
      planner: 'planner_md',
      generator: 'generator_md',
      generatorIntimacy: 'generator_intimacy_md',
      emotionAppraiser: 'emotion_appraiser_md',
      extractor: 'extractor_md',
      reflector: 'reflector_md',
      ranker: 'ranker_md',
    } as const;
    const column = columnMap[promptKey];

    await db.execute({
      sql: `UPDATE workspace_draft_state SET ${column} = ?, updated_at = ? WHERE workspace_id = ?`,
      args: [content, now, workspaceId],
    });

    await db.execute({
      sql: `UPDATE character_workspaces SET updated_at = ? WHERE id = ?`,
      args: [now, workspaceId],
    });
  },

  // ==========================================
  // Autosave
  // ==========================================

  /**
   * Create an autosave entry.
   */
  async createAutosave(input: {
    workspaceId: string;
    section: string;
    data: unknown;
  }): Promise<Autosave> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO workspace_autosaves (id, workspace_id, section, data_json, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, input.workspaceId, input.section, JSON.stringify(input.data), now],
    });

    return AutosaveSchema.parse({
      id,
      workspaceId: input.workspaceId,
      section: input.section,
      data: input.data,
      createdAt: now,
    });
  },

  /**
   * Get latest autosave for a section.
   */
  async getLatestAutosave(workspaceId: string, section: string): Promise<Autosave | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM workspace_autosaves
            WHERE workspace_id = ? AND section = ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [workspaceId, section],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return AutosaveSchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      section: row.section,
      data: JSON.parse(row.data_json as string),
      createdAt: row.created_at,
    });
  },

  /**
   * Clean old autosaves, keeping only the latest N per section.
   */
  async cleanAutosaves(workspaceId: string, keepCount: number = 10): Promise<void> {
    const db = getDb();

    // Get distinct sections
    const sections = await db.execute({
      sql: `SELECT DISTINCT section FROM workspace_autosaves WHERE workspace_id = ?`,
      args: [workspaceId],
    });

    for (const sectionRow of sections.rows) {
      const section = sectionRow.section as string;
      await db.execute({
        sql: `DELETE FROM workspace_autosaves
              WHERE workspace_id = ? AND section = ? AND id NOT IN (
                SELECT id FROM workspace_autosaves
                WHERE workspace_id = ? AND section = ?
                ORDER BY created_at DESC LIMIT ?
              )`,
        args: [workspaceId, section, workspaceId, section, keepCount],
      });
    }
  },

  // ==========================================
  // Editor Context
  // ==========================================

  /**
   * Save editor context.
   */
  async saveEditorContext(workspaceId: string, context: EditorContext): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO workspace_editor_context (workspace_id, context_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(workspace_id) DO UPDATE SET context_json = ?, updated_at = ?`,
      args: [workspaceId, JSON.stringify(context), now, JSON.stringify(context), now],
    });
  },

  /**
   * Get editor context.
   */
  async getEditorContext(workspaceId: string): Promise<EditorContext | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT context_json FROM workspace_editor_context WHERE workspace_id = ?`,
      args: [workspaceId],
    });

    if (result.rows.length === 0) return null;
    return EditorContextSchema.parse(JSON.parse(result.rows[0].context_json as string));
  },

  // ==========================================
  // Playground Sessions
  // ==========================================

  /**
   * Create a playground session.
   */
  async createSession(input: {
    workspaceId: string;
    userId: string;
  }): Promise<PlaygroundSession> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO playground_sessions (id, workspace_id, user_id, is_sandbox, created_at)
            VALUES (?, ?, ?, 1, ?)`,
      args: [id, input.workspaceId, input.userId, now],
    });

    return PlaygroundSessionSchema.parse({
      id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      isSandbox: true,
      createdAt: now,
    });
  },

  /**
   * Get session by ID.
   */
  async getSession(sessionId: string): Promise<PlaygroundSession | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM playground_sessions WHERE id = ?`,
      args: [sessionId],
    });

    if (result.rows.length === 0) return null;

    return parsePlaygroundSessionRow(result.rows[0] as Record<string, unknown>);
  },

  /**
   * Get the latest sandbox session for a workspace/user pair.
   */
  async getLatestSessionForUser(
    workspaceId: string,
    userId: string
  ): Promise<PlaygroundSession | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM playground_sessions
            WHERE workspace_id = ? AND user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [workspaceId, userId],
    });

    if (result.rows.length === 0) return null;
    return parsePlaygroundSessionRow(result.rows[0] as Record<string, unknown>);
  },

  /**
   * List sessions for a workspace.
   */
  async listSessions(workspaceId: string): Promise<PlaygroundSession[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM playground_sessions WHERE workspace_id = ? ORDER BY created_at DESC`,
      args: [workspaceId],
    });

    return result.rows.map((row) => parsePlaygroundSessionRow(row as Record<string, unknown>));
  },

  /**
   * Delete a single playground session and its sandbox state.
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    await deleteSessionData(sessionId);
    return true;
  },

  /**
   * Get persisted sandbox pair state for a session.
   */
  async getSandboxPairState(sessionId: string): Promise<SandboxPairState | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM sandbox_pair_state WHERE session_id = ?`,
      args: [sessionId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const appraisalRaw =
      JSON.parse((row.appraisal_json as string) || '{}') as Record<string, unknown>;

    return SandboxPairStateSchema.parse({
      sessionId: row.session_id,
      activePhaseId: row.active_phase_id,
      affinity: row.affinity,
      trust: row.trust,
      intimacyReadiness: row.intimacy_readiness,
      conflict: row.conflict,
      emotion: {
        fastAffect: JSON.parse(String(row.pad_fast_json ?? row.pad_json)),
        slowMood: JSON.parse(String(row.pad_slow_json ?? row.pad_json)),
        combined: JSON.parse(String(row.pad_combined_json ?? row.pad_json)),
        lastUpdatedAt: row.last_emotion_updated_at ?? row.updated_at,
      },
      pad: JSON.parse(String(row.pad_combined_json ?? row.pad_json)),
      appraisal: {
        goalCongruence: asNumber(appraisalRaw.goalCongruence, NEUTRAL_APPRAISAL.goalCongruence),
        controllability: asNumber(appraisalRaw.controllability, NEUTRAL_APPRAISAL.controllability),
        certainty: asNumber(appraisalRaw.certainty, NEUTRAL_APPRAISAL.certainty),
        normAlignment: asNumber(appraisalRaw.normAlignment, NEUTRAL_APPRAISAL.normAlignment),
        attachmentSecurity: asNumber(appraisalRaw.attachmentSecurity, NEUTRAL_APPRAISAL.attachmentSecurity),
        reciprocity: asNumber(appraisalRaw.reciprocity, NEUTRAL_APPRAISAL.reciprocity),
        pressureIntrusiveness: asNumber(appraisalRaw.pressureIntrusiveness, NEUTRAL_APPRAISAL.pressureIntrusiveness),
        novelty: asNumber(appraisalRaw.novelty, NEUTRAL_APPRAISAL.novelty),
        selfRelevance: asNumber(appraisalRaw.selfRelevance, NEUTRAL_APPRAISAL.selfRelevance),
      },
      openThreadCount: row.open_thread_count,
      updatedAt: row.updated_at,
    });
  },

  /**
   * Persist sandbox pair state so sandbox chat can carry emotion and phase forward.
   */
  async saveSandboxPairState(input: {
    sessionId: string;
    activePhaseId: string;
    affinity: number;
    trust: number;
    intimacyReadiness: number;
    conflict: number;
    emotion: SandboxPairState['emotion'];
    pad: SandboxPairState['pad'];
    appraisal: SandboxPairState['appraisal'];
    openThreadCount: number;
  }): Promise<SandboxPairState> {
    const db = getDb();
    const now = new Date().toISOString();
    const combinedJson = JSON.stringify(input.emotion.combined);
    const fastJson = JSON.stringify(input.emotion.fastAffect);
    const slowJson = JSON.stringify(input.emotion.slowMood);
    const appraisalJson = JSON.stringify(input.appraisal);
    const lastUpdatedAt = input.emotion.lastUpdatedAt.toISOString();

    await db.execute({
      sql: `INSERT INTO sandbox_pair_state
            (session_id, active_phase_id, affinity, trust, intimacy_readiness, conflict, pad_json, pad_fast_json, pad_slow_json, pad_combined_json, last_emotion_updated_at, appraisal_json, open_thread_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
              active_phase_id = ?,
              affinity = ?,
              trust = ?,
              intimacy_readiness = ?,
              conflict = ?,
              pad_json = ?,
              pad_fast_json = ?,
              pad_slow_json = ?,
              pad_combined_json = ?,
              last_emotion_updated_at = ?,
              appraisal_json = ?,
              open_thread_count = ?,
              updated_at = ?`,
      args: [
        input.sessionId,
        input.activePhaseId,
        input.affinity,
        input.trust,
        input.intimacyReadiness,
        input.conflict,
        combinedJson,
        fastJson,
        slowJson,
        combinedJson,
        lastUpdatedAt,
        appraisalJson,
        input.openThreadCount,
        now,
        input.activePhaseId,
        input.affinity,
        input.trust,
        input.intimacyReadiness,
        input.conflict,
        combinedJson,
        fastJson,
        slowJson,
        combinedJson,
        lastUpdatedAt,
        appraisalJson,
        input.openThreadCount,
        now,
      ],
    });

    return SandboxPairStateSchema.parse({
      sessionId: input.sessionId,
      activePhaseId: input.activePhaseId,
      affinity: input.affinity,
      trust: input.trust,
      intimacyReadiness: input.intimacyReadiness,
      conflict: input.conflict,
      emotion: input.emotion,
      pad: input.emotion.combined,
      appraisal: input.appraisal,
      openThreadCount: input.openThreadCount,
      updatedAt: now,
    });
  },

  /**
   * Get sandbox working memory for a session.
   */
  async getSandboxWorkingMemory(sessionId: string): Promise<WorkingMemory | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT data_json FROM sandbox_working_memory WHERE session_id = ?`,
      args: [sessionId],
    });

    if (result.rows.length === 0) return null;
    return WorkingMemorySchema.parse(JSON.parse(String(result.rows[0].data_json)));
  },

  /**
   * Persist sandbox working memory.
   */
  async saveSandboxWorkingMemory(sessionId: string, data: WorkingMemory): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO sandbox_working_memory (session_id, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET data_json = ?, updated_at = ?`,
      args: [sessionId, JSON.stringify(data), now, JSON.stringify(data), now],
    });
  },

  getDefaultSandboxWorkingMemory(): WorkingMemory {
    return {
      preferredAddressForm: DEFAULT_WORKING_MEMORY.preferredAddressForm,
      knownLikes: [...DEFAULT_WORKING_MEMORY.knownLikes],
      knownDislikes: [...DEFAULT_WORKING_MEMORY.knownDislikes],
      currentCooldowns: { ...DEFAULT_WORKING_MEMORY.currentCooldowns },
      activeTensionSummary: DEFAULT_WORKING_MEMORY.activeTensionSummary,
      relationshipStance: DEFAULT_WORKING_MEMORY.relationshipStance,
      knownCorrections: [...DEFAULT_WORKING_MEMORY.knownCorrections],
      intimacyContextHints: [...DEFAULT_WORKING_MEMORY.intimacyContextHints],
    };
  },

  /**
   * Create sandbox memory event.
   */
  async createSandboxEvent(input: {
    sessionId: string;
    sourceTurnId: string | null;
    eventType: string;
    summary: string;
    salience: number;
    retrievalKeys: string[];
    emotionSignature: PADState | null;
    participants: string[];
    supersedesEventId?: string | null;
  }): Promise<MemoryEvent> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO sandbox_memory_events
            (id, session_id, source_turn_id, event_type, summary, salience, retrieval_keys_json, emotion_signature_json, participants_json, supersedes_event_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.sessionId,
        input.sourceTurnId,
        input.eventType,
        input.summary,
        input.salience,
        JSON.stringify(input.retrievalKeys),
        input.emotionSignature ? JSON.stringify(input.emotionSignature) : null,
        JSON.stringify(input.participants),
        input.supersedesEventId ?? null,
        now,
      ],
    });

    return MemoryEventSchema.parse({
      id,
      pairId: input.sessionId,
      sourceTurnId: input.sourceTurnId,
      eventType: input.eventType,
      summary: input.summary,
      salience: input.salience,
      retrievalKeys: input.retrievalKeys,
      emotionSignature: input.emotionSignature,
      participants: input.participants,
      qualityScore: null,
      supersedesEventId: input.supersedesEventId ?? null,
      createdAt: now,
    });
  },

  async getSandboxEventsBySession(sessionId: string, limit = 50): Promise<MemoryEvent[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM sandbox_memory_events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [sessionId, limit],
    });

    return result.rows.map((row) => parseSandboxEventRow(row as Record<string, unknown>));
  },

  /**
   * Create sandbox graph fact.
   */
  async createSandboxFact(input: {
    sessionId: string;
    subject: string;
    predicate: string;
    object: unknown;
    confidence: number;
    sourceEventId?: string | null;
    supersedesFactId?: string | null;
  }): Promise<MemoryFact> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    if (input.supersedesFactId) {
      await db.execute({
        sql: `UPDATE sandbox_memory_facts SET status = 'superseded' WHERE id = ?`,
        args: [input.supersedesFactId],
      });
    }

    await db.execute({
      sql: `INSERT INTO sandbox_memory_facts
            (id, session_id, subject, predicate, object_json, confidence, status, supersedes_fact_id, source_event_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      args: [
        id,
        input.sessionId,
        input.subject,
        input.predicate,
        JSON.stringify(input.object),
        input.confidence,
        input.supersedesFactId ?? null,
        input.sourceEventId ?? null,
        now,
      ],
    });

    return MemoryFactSchema.parse({
      id,
      pairId: input.sessionId,
      subject: input.subject,
      predicate: input.predicate,
      object: input.object,
      confidence: input.confidence,
      status: 'active',
      supersedesFactId: input.supersedesFactId ?? null,
      sourceEventId: input.sourceEventId ?? null,
      createdAt: now,
    });
  },

  async getSandboxFactsBySession(
    sessionId: string,
    options: { status?: MemoryFactStatus } = {}
  ): Promise<MemoryFact[]> {
    const db = getDb();
    let sql = `SELECT * FROM sandbox_memory_facts WHERE session_id = ?`;
    const args: (string | number)[] = [sessionId];

    if (options.status) {
      sql += ` AND status = ?`;
      args.push(options.status);
    }

    sql += ` ORDER BY created_at DESC`;
    const result = await db.execute({ sql, args });
    return result.rows.map((row) => parseSandboxFactRow(row as Record<string, unknown>));
  },

  async getSandboxFactsBySubject(sessionId: string, subject: string): Promise<MemoryFact[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM sandbox_memory_facts WHERE session_id = ? AND subject = ? AND status = 'active'`,
      args: [sessionId, subject],
    });
    return result.rows.map((row) => parseSandboxFactRow(row as Record<string, unknown>));
  },

  async updateSandboxFactStatus(factId: string, status: MemoryFactStatus): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE sandbox_memory_facts SET status = ? WHERE id = ?`,
      args: [status, factId],
    });
  },

  /**
   * Create sandbox observation.
   */
  async createSandboxObservation(input: {
    sessionId: string;
    summary: string;
    retrievalKeys: string[];
    salience: number;
    windowStartAt: Date;
    windowEndAt: Date;
  }): Promise<MemoryObservation> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO sandbox_memory_observations
            (id, session_id, summary, retrieval_keys_json, salience, window_start_at, window_end_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.sessionId,
        input.summary,
        JSON.stringify(input.retrievalKeys),
        input.salience,
        input.windowStartAt.toISOString(),
        input.windowEndAt.toISOString(),
        now,
      ],
    });

    return MemoryObservationSchema.parse({
      id,
      pairId: input.sessionId,
      summary: input.summary,
      retrievalKeys: input.retrievalKeys,
      salience: input.salience,
      qualityScore: null,
      windowStartAt: input.windowStartAt,
      windowEndAt: input.windowEndAt,
      createdAt: now,
    });
  },

  async getSandboxObservationsBySession(sessionId: string, limit = 20): Promise<MemoryObservation[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM sandbox_memory_observations WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [sessionId, limit],
    });

    return result.rows.map((row) => parseSandboxObservationRow(row as Record<string, unknown>));
  },

  async updateSandboxEventQuality(eventId: string, qualityScore: number): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE sandbox_memory_events SET quality_score = ? WHERE id = ?`,
      args: [qualityScore, eventId],
    });
  },

  async updateSandboxObservationQuality(observationId: string, qualityScore: number): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE sandbox_memory_observations SET quality_score = ? WHERE id = ?`,
      args: [qualityScore, observationId],
    });
  },

  /**
   * Create or update sandbox open thread.
   */
  async createOrUpdateSandboxThread(input: {
    sessionId: string;
    key: string;
    summary: string;
    severity: number;
    openedByEventId?: string | null;
  }): Promise<OpenThread> {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = await db.execute({
      sql: `SELECT * FROM sandbox_memory_open_threads WHERE session_id = ? AND key = ?`,
      args: [input.sessionId, input.key],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE sandbox_memory_open_threads
              SET summary = ?, severity = ?, status = 'open', updated_at = ?
              WHERE session_id = ? AND key = ?`,
        args: [input.summary, input.severity, now, input.sessionId, input.key],
      });

      return OpenThreadSchema.parse({
        id: existing.rows[0].id,
        pairId: input.sessionId,
        key: input.key,
        summary: input.summary,
        severity: input.severity,
        status: 'open',
        openedByEventId: existing.rows[0].opened_by_event_id,
        resolvedByEventId: null,
        updatedAt: now,
      });
    }

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO sandbox_memory_open_threads
            (id, session_id, key, summary, severity, status, opened_by_event_id, updated_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      args: [id, input.sessionId, input.key, input.summary, input.severity, input.openedByEventId ?? null, now],
    });

    return OpenThreadSchema.parse({
      id,
      pairId: input.sessionId,
      key: input.key,
      summary: input.summary,
      severity: input.severity,
      status: 'open',
      openedByEventId: input.openedByEventId ?? null,
      resolvedByEventId: null,
      updatedAt: now,
    });
  },

  async resolveSandboxThread(
    sessionId: string,
    key: string,
    resolvedByEventId?: string
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    await db.execute({
      sql: `UPDATE sandbox_memory_open_threads
            SET status = 'resolved', resolved_by_event_id = ?, updated_at = ?
            WHERE session_id = ? AND key = ?`,
      args: [resolvedByEventId ?? null, now, sessionId, key],
    });
  },

  async getSandboxOpenThreads(sessionId: string): Promise<OpenThread[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM sandbox_memory_open_threads WHERE session_id = ? AND status = 'open' ORDER BY severity DESC`,
      args: [sessionId],
    });

    return result.rows.map((row) => parseSandboxThreadRow(row as Record<string, unknown>));
  },

  async createSandboxMemoryUsage(input: {
    sessionId: string;
    memoryItemType: MemoryUsage['memoryItemType'];
    memoryItemId: string;
    turnId: string;
    wasSelected: boolean;
    wasHelpful: boolean | null;
    scoreDelta: number | null;
  }): Promise<MemoryUsage> {
    const db = getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO sandbox_memory_usage
            (id, session_id, memory_item_type, memory_item_id, turn_id, was_selected, was_helpful, score_delta, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.sessionId,
        input.memoryItemType,
        input.memoryItemId,
        input.turnId,
        input.wasSelected ? 1 : 0,
        input.wasHelpful === null ? null : input.wasHelpful ? 1 : 0,
        input.scoreDelta,
        now,
      ],
    });

    return MemoryUsageSchema.parse({
      id,
      memoryItemType: input.memoryItemType,
      memoryItemId: input.memoryItemId,
      turnId: input.turnId,
      wasSelected: input.wasSelected,
      wasHelpful: input.wasHelpful,
      scoreDelta: input.scoreDelta,
      createdAt: now,
    });
  },

  /**
   * Create a playground turn.
   */
  async createTurn(input: {
    id?: string;
    sessionId: string;
    userMessageText: string;
    assistantMessageText: string;
    traceJson: unknown;
  }): Promise<PlaygroundTurn> {
    const db = getDb();
    const id = input.id ?? uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO playground_turns (id, session_id, user_message_text, assistant_message_text, trace_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, input.sessionId, input.userMessageText, input.assistantMessageText, JSON.stringify(input.traceJson), now],
    });

    return PlaygroundTurnSchema.parse({
      id,
      sessionId: input.sessionId,
      userMessageText: input.userMessageText,
      assistantMessageText: input.assistantMessageText,
      traceJson: input.traceJson,
      createdAt: now,
    });
  },

  async updateTurnTrace(turnId: string, traceJson: unknown): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE playground_turns SET trace_json = ? WHERE id = ?`,
      args: [JSON.stringify(traceJson), turnId],
    });
  },

  /**
   * Get turns for a session.
   */
  async getTurns(sessionId: string): Promise<PlaygroundTurn[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM playground_turns WHERE session_id = ? ORDER BY created_at ASC`,
      args: [sessionId],
    });

    return result.rows.map((row) =>
      PlaygroundTurnSchema.parse({
        id: row.id,
        sessionId: row.session_id,
        userMessageText: row.user_message_text,
        assistantMessageText: row.assistant_message_text,
        traceJson: JSON.parse(row.trace_json as string),
        createdAt: row.created_at,
      })
    );
  },
};
