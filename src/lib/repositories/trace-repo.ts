import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import {
  CoEEvidenceExtractorResult,
  EmotionTrace,
  LegacyEmotionComparison,
  TurnTrace,
  TurnTraceSchema,
  ChatTurn,
  ChatTurnSchema,
  PADState,
  RuntimeEmotionState,
  AppraisalVector,
  TurnPlan,
  Candidate,
  MemoryWrite,
  RelationshipMetrics,
  RelationshipMetricDelta,
  PhaseTransitionEvaluation,
  PromptAssemblyHashes,
  MemoryThresholdDecision,
  PADTransitionContribution,
} from '../schemas';

const DEFAULT_RELATIONSHIP_METRICS: RelationshipMetrics = {
  affinity: 50,
  trust: 50,
  intimacyReadiness: 0,
  conflict: 0,
};

const DEFAULT_RELATIONSHIP_DELTAS: RelationshipMetricDelta = {
  affinity: 0,
  trust: 0,
  intimacyReadiness: 0,
  conflict: 0,
};

const DEFAULT_PHASE_TRANSITION_EVALUATION: PhaseTransitionEvaluation = {
  shouldTransition: false,
  targetPhaseId: null,
  reason: 'unknown',
  satisfiedConditions: [],
  failedConditions: [],
};

const DEFAULT_PROMPT_HASHES: PromptAssemblyHashes = {
  planner: '',
  generator: '',
  ranker: '',
  extractor: '',
};

function parseRuntimeEmotionState(
  runtimeJson: string | null | undefined,
  padJson: string
): RuntimeEmotionState {
  if (runtimeJson) {
    return JSON.parse(runtimeJson) as RuntimeEmotionState;
  }

  const combined = JSON.parse(padJson) as PADState;
  return {
    fastAffect: combined,
    slowMood: combined,
    combined,
    lastUpdatedAt: new Date(0),
  };
}

function parseJsonWithFallback<T>(
  raw: string | null | undefined,
  fallback: T
): T {
  return raw ? (JSON.parse(raw) as T) : fallback;
}

/**
 * Repository for trace and chat turn operations.
 */
export const traceRepo = {
  /**
   * Create a turn trace.
   */
  async createTrace(input: {
    id?: string;
    pairId: string;
    characterVersionId: string;
    promptBundleVersionId: string;
    modelIds: {
      planner: string;
      generator: string;
      ranker: string;
      extractor: string | null;
    };
    phaseIdBefore: string;
    phaseIdAfter: string;
    emotionBefore: PADState;
    emotionAfter: PADState;
    emotionStateBefore: RuntimeEmotionState;
    emotionStateAfter: RuntimeEmotionState;
    relationshipBefore: RelationshipMetrics;
    relationshipAfter: RelationshipMetrics;
    relationshipDeltas: RelationshipMetricDelta;
    phaseTransitionEvaluation: PhaseTransitionEvaluation;
    promptAssemblyHashes: PromptAssemblyHashes;
    appraisal: AppraisalVector;
    retrievedMemoryIds: {
      events: string[];
      facts: string[];
      observations: string[];
      threads: string[];
    };
    coeExtraction?: CoEEvidenceExtractorResult | null;
    emotionTrace?: EmotionTrace | null;
    legacyComparison?: LegacyEmotionComparison | null;
    memoryThresholdDecisions: MemoryThresholdDecision[];
    coeContributions: PADTransitionContribution[];
    plan: TurnPlan;
    candidates: Candidate[];
    winnerIndex: number;
    memoryWrites: MemoryWrite[];
    userMessage: string;
    assistantMessage: string;
  }): Promise<TurnTrace> {
    const db = getDb();
    const id = input.id ?? uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO turn_traces
            (id, pair_id, character_version_id, prompt_bundle_version_id, model_ids_json,
             phase_id_before, phase_id_after, emotion_before_json, emotion_after_json,
             emotion_state_before_json, emotion_state_after_json, relationship_before_json, relationship_after_json,
             relationship_deltas_json, phase_transition_evaluation_json, prompt_assembly_hashes_json,
             appraisal_json, retrieved_memory_ids_json, coe_extraction_json, emotion_trace_json, legacy_comparison_json,
             memory_threshold_decisions_json, coe_contributions_json,
             plan_json, candidates_json, winner_index, memory_writes_json, user_message, assistant_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.pairId,
        input.characterVersionId,
        input.promptBundleVersionId,
        JSON.stringify(input.modelIds),
        input.phaseIdBefore,
        input.phaseIdAfter,
        JSON.stringify(input.emotionBefore),
        JSON.stringify(input.emotionAfter),
        JSON.stringify(input.emotionStateBefore),
        JSON.stringify(input.emotionStateAfter),
        JSON.stringify(input.relationshipBefore),
        JSON.stringify(input.relationshipAfter),
        JSON.stringify(input.relationshipDeltas),
        JSON.stringify(input.phaseTransitionEvaluation),
        JSON.stringify(input.promptAssemblyHashes),
        JSON.stringify(input.appraisal),
        JSON.stringify(input.retrievedMemoryIds),
        input.coeExtraction ? JSON.stringify(input.coeExtraction) : null,
        input.emotionTrace ? JSON.stringify(input.emotionTrace) : null,
        input.legacyComparison ? JSON.stringify(input.legacyComparison) : null,
        JSON.stringify(input.memoryThresholdDecisions),
        JSON.stringify(input.coeContributions),
        JSON.stringify(input.plan),
        JSON.stringify(input.candidates),
        input.winnerIndex,
        JSON.stringify(input.memoryWrites),
        input.userMessage,
        input.assistantMessage,
        now,
      ],
    });

    return TurnTraceSchema.parse({
      id,
      pairId: input.pairId,
      characterVersionId: input.characterVersionId,
      promptBundleVersionId: input.promptBundleVersionId,
      modelIds: input.modelIds,
      phaseIdBefore: input.phaseIdBefore,
      phaseIdAfter: input.phaseIdAfter,
      emotionBefore: input.emotionBefore,
      emotionAfter: input.emotionAfter,
      emotionStateBefore: input.emotionStateBefore,
      emotionStateAfter: input.emotionStateAfter,
      relationshipBefore: input.relationshipBefore,
      relationshipAfter: input.relationshipAfter,
      relationshipDeltas: input.relationshipDeltas,
      phaseTransitionEvaluation: input.phaseTransitionEvaluation,
      promptAssemblyHashes: input.promptAssemblyHashes,
      appraisal: input.appraisal,
      retrievedMemoryIds: input.retrievedMemoryIds,
      coeExtraction: input.coeExtraction ?? null,
      emotionTrace: input.emotionTrace ?? null,
      legacyComparison: input.legacyComparison ?? null,
      memoryThresholdDecisions: input.memoryThresholdDecisions,
      coeContributions: input.coeContributions,
      plan: input.plan,
      candidates: input.candidates,
      winnerIndex: input.winnerIndex,
      memoryWrites: input.memoryWrites,
      userMessage: input.userMessage,
      assistantMessage: input.assistantMessage,
      createdAt: now,
    });
  },

  /**
   * Get trace by ID.
   */
  async getTraceById(id: string): Promise<TurnTrace | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM turn_traces WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return TurnTraceSchema.parse({
      id: row.id,
      pairId: row.pair_id,
      characterVersionId: row.character_version_id,
      promptBundleVersionId: row.prompt_bundle_version_id,
      modelIds: JSON.parse(row.model_ids_json as string),
      phaseIdBefore: row.phase_id_before,
      phaseIdAfter: row.phase_id_after,
      emotionBefore: JSON.parse(row.emotion_before_json as string),
      emotionAfter: JSON.parse(row.emotion_after_json as string),
      emotionStateBefore: parseRuntimeEmotionState(
        row.emotion_state_before_json as string | null | undefined,
        row.emotion_before_json as string
      ),
      emotionStateAfter: parseRuntimeEmotionState(
        row.emotion_state_after_json as string | null | undefined,
        row.emotion_after_json as string
      ),
      relationshipBefore: parseJsonWithFallback(
        row.relationship_before_json as string | null | undefined,
        DEFAULT_RELATIONSHIP_METRICS
      ),
      relationshipAfter: parseJsonWithFallback(
        row.relationship_after_json as string | null | undefined,
        DEFAULT_RELATIONSHIP_METRICS
      ),
      relationshipDeltas: parseJsonWithFallback(
        row.relationship_deltas_json as string | null | undefined,
        DEFAULT_RELATIONSHIP_DELTAS
      ),
      phaseTransitionEvaluation: parseJsonWithFallback(
        row.phase_transition_evaluation_json as string | null | undefined,
        DEFAULT_PHASE_TRANSITION_EVALUATION
      ),
      promptAssemblyHashes: parseJsonWithFallback(
        row.prompt_assembly_hashes_json as string | null | undefined,
        DEFAULT_PROMPT_HASHES
      ),
      appraisal: JSON.parse(row.appraisal_json as string),
      retrievedMemoryIds: JSON.parse(row.retrieved_memory_ids_json as string),
      coeExtraction: parseJsonWithFallback(
        row.coe_extraction_json as string | null | undefined,
        null
      ),
      emotionTrace: parseJsonWithFallback(
        row.emotion_trace_json as string | null | undefined,
        null
      ),
      legacyComparison: parseJsonWithFallback(
        row.legacy_comparison_json as string | null | undefined,
        null
      ),
      memoryThresholdDecisions: JSON.parse((row.memory_threshold_decisions_json ?? '[]') as string),
      coeContributions: JSON.parse((row.coe_contributions_json ?? '[]') as string),
      plan: JSON.parse(row.plan_json as string),
      candidates: JSON.parse(row.candidates_json as string),
      winnerIndex: row.winner_index,
      memoryWrites: JSON.parse(row.memory_writes_json as string),
      userMessage: row.user_message,
      assistantMessage: row.assistant_message,
      createdAt: row.created_at,
    });
  },

  /**
   * Get traces for a pair.
   */
  async getTracesByPair(pairId: string, limit = 50): Promise<TurnTrace[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM turn_traces WHERE pair_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [pairId, limit],
    });

    return result.rows.map((row) =>
      TurnTraceSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        characterVersionId: row.character_version_id,
        promptBundleVersionId: row.prompt_bundle_version_id,
        modelIds: JSON.parse(row.model_ids_json as string),
        phaseIdBefore: row.phase_id_before,
        phaseIdAfter: row.phase_id_after,
        emotionBefore: JSON.parse(row.emotion_before_json as string),
        emotionAfter: JSON.parse(row.emotion_after_json as string),
        emotionStateBefore: parseRuntimeEmotionState(
          row.emotion_state_before_json as string | null | undefined,
          row.emotion_before_json as string
        ),
        emotionStateAfter: parseRuntimeEmotionState(
          row.emotion_state_after_json as string | null | undefined,
          row.emotion_after_json as string
        ),
        relationshipBefore: parseJsonWithFallback(
          row.relationship_before_json as string | null | undefined,
          DEFAULT_RELATIONSHIP_METRICS
        ),
        relationshipAfter: parseJsonWithFallback(
          row.relationship_after_json as string | null | undefined,
          DEFAULT_RELATIONSHIP_METRICS
        ),
        relationshipDeltas: parseJsonWithFallback(
          row.relationship_deltas_json as string | null | undefined,
          DEFAULT_RELATIONSHIP_DELTAS
        ),
        phaseTransitionEvaluation: parseJsonWithFallback(
          row.phase_transition_evaluation_json as string | null | undefined,
          DEFAULT_PHASE_TRANSITION_EVALUATION
        ),
        promptAssemblyHashes: parseJsonWithFallback(
          row.prompt_assembly_hashes_json as string | null | undefined,
          DEFAULT_PROMPT_HASHES
        ),
        appraisal: JSON.parse(row.appraisal_json as string),
        retrievedMemoryIds: JSON.parse(row.retrieved_memory_ids_json as string),
        coeExtraction: parseJsonWithFallback(
          row.coe_extraction_json as string | null | undefined,
          null
        ),
        emotionTrace: parseJsonWithFallback(
          row.emotion_trace_json as string | null | undefined,
          null
        ),
        legacyComparison: parseJsonWithFallback(
          row.legacy_comparison_json as string | null | undefined,
          null
        ),
        memoryThresholdDecisions: JSON.parse((row.memory_threshold_decisions_json ?? '[]') as string),
        coeContributions: JSON.parse((row.coe_contributions_json ?? '[]') as string),
        plan: JSON.parse(row.plan_json as string),
        candidates: JSON.parse(row.candidates_json as string),
        winnerIndex: row.winner_index,
        memoryWrites: JSON.parse(row.memory_writes_json as string),
        userMessage: row.user_message,
        assistantMessage: row.assistant_message,
        createdAt: row.created_at,
      })
    );
  },

  /**
   * Create a chat turn record.
   */
  async createChatTurn(input: {
    id?: string;
    pairId: string;
    threadId: string;
    userMessageText: string;
    assistantMessageText: string;
    plannerJson: unknown;
    rankerJson: unknown;
    traceId: string;
  }): Promise<ChatTurn> {
    const db = getDb();
    const id = input.id ?? uuid();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO chat_turns
            (id, pair_id, thread_id, user_message_text, assistant_message_text, planner_json, ranker_json, trace_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.pairId,
        input.threadId,
        input.userMessageText,
        input.assistantMessageText,
        JSON.stringify(input.plannerJson),
        JSON.stringify(input.rankerJson),
        input.traceId,
        now,
      ],
    });

    return ChatTurnSchema.parse({
      id,
      pairId: input.pairId,
      threadId: input.threadId,
      userMessageText: input.userMessageText,
      assistantMessageText: input.assistantMessageText,
      plannerJson: input.plannerJson,
      rankerJson: input.rankerJson,
      traceId: input.traceId,
      createdAt: now,
    });
  },

  /**
   * Get recent chat turns.
   */
  async getRecentTurns(pairId: string, limit = 20): Promise<ChatTurn[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM chat_turns WHERE pair_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [pairId, limit],
    });

    return result.rows.map((row) =>
      ChatTurnSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        threadId: row.thread_id,
        userMessageText: row.user_message_text,
        assistantMessageText: row.assistant_message_text,
        plannerJson: row.planner_json ? JSON.parse(row.planner_json as string) : null,
        rankerJson: row.ranker_json ? JSON.parse(row.ranker_json as string) : null,
        traceId: row.trace_id,
        createdAt: row.created_at,
      })
    );
  },

  /**
   * Count chat turns since a specific time, or all turns if omitted.
   */
  async countTurnsSince(pairId: string, since?: Date | null): Promise<number> {
    const db = getDb();
    const result = await db.execute({
      sql: since
        ? `SELECT COUNT(*) AS count FROM chat_turns WHERE pair_id = ? AND created_at > ?`
        : `SELECT COUNT(*) AS count FROM chat_turns WHERE pair_id = ?`,
      args: since ? [pairId, since.toISOString()] : [pairId],
    });

    const rawCount = result.rows[0]?.count;
    return Number(rawCount ?? 0);
  },
};
