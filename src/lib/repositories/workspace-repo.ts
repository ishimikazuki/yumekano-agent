import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import { normalizePersonaAuthoring } from '../persona';
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

function normalizeLegacyStyle(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const style = value as Record<string, unknown>;

  return {
    ...style,
    language: style.language === 'en' ? 'ja' : style.language,
    politenessDefault:
      style.politenessDefault === 'formal' ? 'polite' : style.politenessDefault,
  };
}

function normalizeLegacyAutonomy(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const autonomy = value as Record<string, unknown>;

  return {
    ...autonomy,
    disagreeReadiness:
      autonomy.disagreeReadiness ?? autonomy.disagreementReadiness,
    conflictCarryover: autonomy.conflictCarryover ?? autonomy.conflictSustain,
    intimacyNeverOnDemand:
      autonomy.intimacyNeverOnDemand ?? autonomy.intimacyNotOnDemand,
  };
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeLegacyEmotion(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const emotion = value as Record<string, unknown>;

  const baselineRaw =
    (emotion.baselinePAD as Record<string, unknown> | undefined) ??
    (emotion.baseline as Record<string, unknown> | undefined) ??
    {};
  const recoveryRaw =
    (emotion.recovery as Record<string, unknown> | undefined) ?? {};
  const appraisalRaw =
    (emotion.appraisalSensitivity as Record<string, unknown> | undefined) ?? {};
  const externalizationRaw =
    (emotion.externalization as Record<string, unknown> | undefined) ?? {};

  return {
    ...emotion,
    baselinePAD: {
      pleasure: asNumber(baselineRaw.pleasure, 0),
      arousal: asNumber(baselineRaw.arousal, 0),
      dominance: asNumber(baselineRaw.dominance, 0),
    },
    recovery: {
      pleasureHalfLifeTurns: asNumber(recoveryRaw.pleasureHalfLifeTurns, 5),
      arousalHalfLifeTurns: asNumber(recoveryRaw.arousalHalfLifeTurns, 3),
      dominanceHalfLifeTurns: asNumber(recoveryRaw.dominanceHalfLifeTurns, 4),
    },
    appraisalSensitivity: {
      goalCongruence: asNumber(appraisalRaw.goalCongruence, 0.6),
      controllability: asNumber(appraisalRaw.controllability, 0.5),
      certainty: asNumber(appraisalRaw.certainty, 0.5),
      normAlignment: asNumber(appraisalRaw.normAlignment, 0.6),
      attachmentSecurity: asNumber(appraisalRaw.attachmentSecurity, 0.7),
      reciprocity: asNumber(appraisalRaw.reciprocity, 0.7),
      pressureIntrusiveness: asNumber(appraisalRaw.pressureIntrusiveness, 0.6),
      novelty: asNumber(appraisalRaw.novelty, 0.5),
    },
    externalization: {
      warmthWeight: asNumber(externalizationRaw.warmthWeight, 0.8),
      tersenessWeight: asNumber(externalizationRaw.tersenessWeight, 0.3),
      directnessWeight: asNumber(externalizationRaw.directnessWeight, 0.5),
      teasingWeight: asNumber(externalizationRaw.teasingWeight, 0.6),
    },
  };
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
      await db.execute({ sql: `DELETE FROM sandbox_working_memory WHERE session_id = ?`, args: [session.id] });
      await db.execute({ sql: `DELETE FROM sandbox_pair_state WHERE session_id = ?`, args: [session.id] });
      await db.execute({ sql: `DELETE FROM playground_turns WHERE session_id = ?`, args: [session.id] });
    }
    await db.execute({ sql: `DELETE FROM playground_sessions WHERE workspace_id = ?`, args: [id] });
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
    const prompts = PromptBundleContentSchema.parse(draft.prompts);

    await db.execute({
      sql: `INSERT INTO workspace_draft_state
            (workspace_id, identity_json, persona_json, style_json, autonomy_json, emotion_json, memory_policy_json, phase_graph_json, planner_md, generator_md, generator_intimacy_md, extractor_md, reflector_md, ranker_md, base_version_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        workspaceId,
        JSON.stringify(draft.identity),
        JSON.stringify(normalizePersonaAuthoring(draft.persona)),
        JSON.stringify(draft.style),
        JSON.stringify(draft.autonomy),
        JSON.stringify(draft.emotion),
        JSON.stringify(draft.memory),
        JSON.stringify(draft.phaseGraph),
        prompts.plannerMd,
        prompts.generatorMd,
        prompts.generatorIntimacyMd,
        prompts.extractorMd,
        prompts.reflectorMd,
        prompts.rankerMd,
        draft.baseVersionId,
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
      prompts: {
        plannerMd: row.planner_md as string,
        generatorMd: row.generator_md as string,
        generatorIntimacyMd: row.generator_intimacy_md as string | undefined,
        extractorMd: row.extractor_md as string,
        reflectorMd: row.reflector_md as string,
        rankerMd: row.ranker_md as string,
      },
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
              SET planner_md = ?, generator_md = ?, generator_intimacy_md = ?, extractor_md = ?, reflector_md = ?, ranker_md = ?, updated_at = ?
              WHERE workspace_id = ?`,
        args: [
          prompts.plannerMd,
          prompts.generatorMd,
          prompts.generatorIntimacyMd,
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
      | 'planner'
      | 'generator'
      | 'generatorIntimacy'
      | 'extractor'
      | 'reflector'
      | 'ranker',
    content: string
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const columnMap = {
      planner: 'planner_md',
      generator: 'generator_md',
      generatorIntimacy: 'generator_intimacy_md',
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
      sql: `INSERT OR REPLACE INTO workspace_editor_context (workspace_id, context_json, updated_at)
            VALUES (?, ?, ?)`,
      args: [workspaceId, JSON.stringify(context), now],
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

    const row = result.rows[0];
    return PlaygroundSessionSchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      isSandbox: Boolean(row.is_sandbox),
      createdAt: row.created_at,
    });
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

    return result.rows.map((row) =>
      PlaygroundSessionSchema.parse({
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        isSandbox: Boolean(row.is_sandbox),
        createdAt: row.created_at,
      })
    );
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
      pad: JSON.parse(row.pad_json as string),
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
    pad: SandboxPairState['pad'];
    appraisal: SandboxPairState['appraisal'];
    openThreadCount: number;
  }): Promise<SandboxPairState> {
    const db = getDb();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT OR REPLACE INTO sandbox_pair_state
            (session_id, active_phase_id, affinity, trust, intimacy_readiness, conflict, pad_json, appraisal_json, open_thread_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.sessionId,
        input.activePhaseId,
        input.affinity,
        input.trust,
        input.intimacyReadiness,
        input.conflict,
        JSON.stringify(input.pad),
        JSON.stringify(input.appraisal),
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
      pad: input.pad,
      appraisal: input.appraisal,
      openThreadCount: input.openThreadCount,
      updatedAt: now,
    });
  },

  /**
   * Create a playground turn.
   */
  async createTurn(input: {
    sessionId: string;
    userMessageText: string;
    assistantMessageText: string;
    traceJson: unknown;
  }): Promise<PlaygroundTurn> {
    const db = getDb();
    const id = uuid();
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
