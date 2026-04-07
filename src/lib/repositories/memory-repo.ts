import { getDb } from '../db/client';
import { v4 as uuid } from 'uuid';
import {
  MemoryEvent,
  MemoryEventSchema,
  MemoryFact,
  MemoryFactSchema,
  MemoryFactStatus,
  MemoryObservation,
  MemoryObservationSchema,
  OpenThread,
  OpenThreadSchema,
  OpenThreadStatus,
  WorkingMemory,
  WorkingMemorySchema,
  PADState,
  MemoryUsage,
  MemoryUsageSchema,
} from '../schemas';

/**
 * Repository for memory operations.
 */
/**
 * Safely parse JSON string with error context
 */
function parseJsonSafely<T = unknown>(jsonString: string, context: string): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON in ${context}: ${errorMsg}`);
  }
}

export const memoryRepo = {
  // ==========================================
  // Events
  // ==========================================

  async createEvent(input: {
    pairId: string;
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
      sql: `INSERT INTO memory_events
            (id, pair_id, source_turn_id, event_type, summary, salience, retrieval_keys_json, emotion_signature_json, participants_json, supersedes_event_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.pairId,
        input.sourceTurnId ?? null,
        input.eventType ?? 'unknown',
        input.summary ?? '',
        input.salience ?? 0.5,
        JSON.stringify(input.retrievalKeys ?? []),
        input.emotionSignature ? JSON.stringify(input.emotionSignature) : null,
        JSON.stringify(input.participants ?? []),
        input.supersedesEventId ?? null,
        now,
      ],
    });

    return MemoryEventSchema.parse({
      id,
      pairId: input.pairId,
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

  async getEventsByPair(pairId: string, limit = 50): Promise<MemoryEvent[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM memory_events WHERE pair_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [pairId, limit],
    });

    return result.rows.map((row) =>
      MemoryEventSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        sourceTurnId: row.source_turn_id,
        eventType: row.event_type,
        summary: row.summary,
        salience: row.salience,
        retrievalKeys: parseJsonSafely<unknown>(row.retrieval_keys_json as string, "memory-repo"),
        emotionSignature: row.emotion_signature_json
          ? parseJsonSafely<unknown>(row.emotion_signature_json as string, "memory-repo")
          : null,
        participants: parseJsonSafely<unknown>(row.participants_json as string, "memory-repo"),
        qualityScore: row.quality_score,
        supersedesEventId: row.supersedes_event_id,
        createdAt: row.created_at,
      })
    );
  },

  // ==========================================
  // Facts
  // ==========================================

  async createFact(input: {
    pairId: string;
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

    // If superseding, mark old fact as superseded
    if (input.supersedesFactId) {
      await db.execute({
        sql: `UPDATE memory_facts SET status = 'superseded' WHERE id = ?`,
        args: [input.supersedesFactId],
      });
    }

    await db.execute({
      sql: `INSERT INTO memory_facts
            (id, pair_id, subject, predicate, object_json, confidence, status, supersedes_fact_id, source_event_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.pairId,
        input.subject ?? 'unknown',
        input.predicate ?? 'unknown',
        JSON.stringify(input.object ?? null),
        input.confidence ?? 0.5,
        'active',
        input.supersedesFactId ?? null,
        input.sourceEventId ?? null,
        now,
      ],
    });

    return MemoryFactSchema.parse({
      id,
      pairId: input.pairId,
      subject: input.subject,
      predicate: input.predicate,
      object: input.object,
      confidence: input.confidence,
      status: 'active' as MemoryFactStatus,
      supersedesFactId: input.supersedesFactId ?? null,
      sourceEventId: input.sourceEventId ?? null,
      createdAt: now,
    });
  },

  async getFactsByPair(
    pairId: string,
    options: { status?: MemoryFactStatus } = {}
  ): Promise<MemoryFact[]> {
    const db = getDb();
    let sql = `SELECT * FROM memory_facts WHERE pair_id = ?`;
    const args: (string | number)[] = [pairId];

    if (options.status) {
      sql += ` AND status = ?`;
      args.push(options.status);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await db.execute({ sql, args });

    return result.rows.map((row) =>
      MemoryFactSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        subject: row.subject,
        predicate: row.predicate,
        object: parseJsonSafely<unknown>(row.object_json as string, "memory-repo"),
        confidence: row.confidence,
        status: row.status,
        supersedesFactId: row.supersedes_fact_id,
        sourceEventId: row.source_event_id,
        createdAt: row.created_at,
      })
    );
  },

  async getFactsBySubject(pairId: string, subject: string): Promise<MemoryFact[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM memory_facts WHERE pair_id = ? AND subject = ? AND status = 'active'`,
      args: [pairId, subject],
    });

    return result.rows.map((row) =>
      MemoryFactSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        subject: row.subject,
        predicate: row.predicate,
        object: parseJsonSafely<unknown>(row.object_json as string, "memory-repo"),
        confidence: row.confidence,
        status: row.status,
        supersedesFactId: row.supersedes_fact_id,
        sourceEventId: row.source_event_id,
        createdAt: row.created_at,
      })
    );
  },

  // ==========================================
  // Observations
  // ==========================================

  async createObservation(input: {
    pairId: string;
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
      sql: `INSERT INTO memory_observations
            (id, pair_id, summary, retrieval_keys_json, salience, window_start_at, window_end_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.pairId,
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
      pairId: input.pairId,
      summary: input.summary,
      retrievalKeys: input.retrievalKeys,
      salience: input.salience,
      qualityScore: null,
      windowStartAt: input.windowStartAt,
      windowEndAt: input.windowEndAt,
      createdAt: now,
    });
  },

  async getObservationsByPair(pairId: string, limit = 20): Promise<MemoryObservation[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM memory_observations WHERE pair_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [pairId, limit],
    });

    return result.rows.map((row) =>
      MemoryObservationSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        summary: row.summary,
        retrievalKeys: parseJsonSafely<unknown>(row.retrieval_keys_json as string, "memory-repo"),
        salience: row.salience,
        qualityScore: row.quality_score,
        windowStartAt: row.window_start_at,
        windowEndAt: row.window_end_at,
        createdAt: row.created_at,
      })
    );
  },

  // ==========================================
  // Open Threads
  // ==========================================

  async createOrUpdateThread(input: {
    pairId: string;
    key: string;
    summary: string;
    severity: number;
    openedByEventId?: string | null;
  }): Promise<OpenThread> {
    const db = getDb();
    const now = new Date().toISOString();

    // Check if thread exists
    const existing = await db.execute({
      sql: `SELECT * FROM memory_open_threads WHERE pair_id = ? AND key = ?`,
      args: [input.pairId, input.key],
    });

    if (existing.rows.length > 0) {
      // Update existing
      await db.execute({
        sql: `UPDATE memory_open_threads SET summary = ?, severity = ?, status = 'open', updated_at = ? WHERE pair_id = ? AND key = ?`,
        args: [input.summary, input.severity, now, input.pairId, input.key],
      });

      return OpenThreadSchema.parse({
        id: existing.rows[0].id,
        pairId: input.pairId,
        key: input.key,
        summary: input.summary,
        severity: input.severity,
        status: 'open' as OpenThreadStatus,
        openedByEventId: existing.rows[0].opened_by_event_id,
        resolvedByEventId: null,
        updatedAt: now,
      });
    }

    // Create new
    const id = uuid();
    await db.execute({
      sql: `INSERT INTO memory_open_threads
            (id, pair_id, key, summary, severity, status, opened_by_event_id, updated_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      args: [id, input.pairId, input.key, input.summary, input.severity, input.openedByEventId ?? null, now],
    });

    return OpenThreadSchema.parse({
      id,
      pairId: input.pairId,
      key: input.key,
      summary: input.summary,
      severity: input.severity,
      status: 'open' as OpenThreadStatus,
      openedByEventId: input.openedByEventId ?? null,
      resolvedByEventId: null,
      updatedAt: now,
    });
  },

  async resolveThread(pairId: string, key: string, resolvedByEventId?: string | null): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db.execute({
      sql: `UPDATE memory_open_threads SET status = 'resolved', resolved_by_event_id = ?, updated_at = ? WHERE pair_id = ? AND key = ?`,
      args: [resolvedByEventId ?? null, now, pairId, key],
    });
  },

  async getOpenThreads(pairId: string): Promise<OpenThread[]> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM memory_open_threads WHERE pair_id = ? AND status = 'open' ORDER BY severity DESC`,
      args: [pairId],
    });

    return result.rows.map((row) =>
      OpenThreadSchema.parse({
        id: row.id,
        pairId: row.pair_id,
        key: row.key,
        summary: row.summary,
        severity: row.severity,
        status: row.status,
        openedByEventId: row.opened_by_event_id,
        resolvedByEventId: row.resolved_by_event_id,
        updatedAt: row.updated_at,
      })
    );
  },

  // ==========================================
  // Working Memory
  // ==========================================

  async getWorkingMemory(pairId: string): Promise<WorkingMemory | null> {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT data_json FROM working_memory WHERE pair_id = ?`,
      args: [pairId],
    });

    if (result.rows.length === 0) return null;

    return WorkingMemorySchema.parse(JSON.parse(result.rows[0].data_json as string));
  },

  async setWorkingMemory(pairId: string, data: WorkingMemory): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO working_memory (pair_id, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(pair_id) DO UPDATE SET data_json = ?, updated_at = ?`,
      args: [pairId, JSON.stringify(data), now, JSON.stringify(data), now],
    });
  },

  /**
   * Initialize default working memory.
   */
  getDefaultWorkingMemory(): WorkingMemory {
    return {
      preferredAddressForm: null,
      knownLikes: [],
      knownDislikes: [],
      currentCooldowns: {},
      activeTensionSummary: null,
      relationshipStance: null,
      knownCorrections: [],
      intimacyContextHints: [],
    };
  },

  // ==========================================
  // Quality Updates
  // ==========================================

  async updateEventQuality(eventId: string, qualityScore: number): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE memory_events SET quality_score = ? WHERE id = ?`,
      args: [qualityScore, eventId],
    });
  },

  async updateFactStatus(factId: string, status: MemoryFactStatus): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE memory_facts SET status = ? WHERE id = ?`,
      args: [status, factId],
    });
  },

  async updateObservationQuality(observationId: string, qualityScore: number): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE memory_observations SET quality_score = ? WHERE id = ?`,
      args: [qualityScore, observationId],
    });
  },

  async createMemoryUsage(input: {
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
      sql: `INSERT INTO memory_usage
            (id, memory_item_type, memory_item_id, turn_id, was_selected, was_helpful, score_delta, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
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
};
