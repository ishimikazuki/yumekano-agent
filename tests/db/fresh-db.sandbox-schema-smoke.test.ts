/**
 * T1: Fresh DB sandbox schema smoke test
 *
 * Verifies that on a fresh DB: all sandbox tables exist
 * and basic CRUD operations work.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function withFreshDb(
  fn: (getDb: () => ReturnType<typeof import('@/lib/db/client').getDb>) => Promise<void>
) {
  return async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t1-sandbox-'));
    const dbPath = path.join(tempDir, 'test.db');
    const prevDatabase = process.env.DATABASE_URL;
    const prevLocal = process.env.LOCAL_DATABASE_URL;

    delete process.env.DATABASE_URL;
    process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;

    const { getDb } = await import('@/lib/db/client');
    await getDb().close();

    try {
      await fn(getDb);
    } finally {
      await getDb().close();
      if (prevDatabase === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDatabase;
      if (prevLocal === undefined) delete process.env.LOCAL_DATABASE_URL;
      else process.env.LOCAL_DATABASE_URL = prevLocal;
      rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

const SANDBOX_TABLES = [
  'playground_sessions',
  'playground_turns',
  'sandbox_pair_state',
  'sandbox_working_memory',
  'sandbox_memory_events',
  'sandbox_memory_facts',
  'sandbox_memory_observations',
  'sandbox_memory_open_threads',
  'sandbox_memory_usage',
] as const;

test(
  'T1 fresh DB: all sandbox tables exist after migration',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const result = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = new Set(result.rows.map((r) => r.name as string));

    for (const table of SANDBOX_TABLES) {
      assert.ok(tables.has(table), `Missing sandbox table on fresh DB: ${table}`);
    }
  })
);

test(
  'T1 fresh DB: sandbox pair_state has emotion layer columns',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const info = await db.execute('PRAGMA table_info(sandbox_pair_state)');
    const columns = new Set(info.rows.map((r) => r.name as string));

    const expectedColumns = [
      'session_id',
      'active_phase_id',
      'affinity',
      'trust',
      'intimacy_readiness',
      'conflict',
      'pad_json',
      'pad_fast_json',
      'pad_slow_json',
      'pad_combined_json',
      'last_emotion_updated_at',
      'appraisal_json',
      'open_thread_count',
      'updated_at',
    ];

    for (const col of expectedColumns) {
      assert.ok(columns.has(col), `sandbox_pair_state missing column: ${col}`);
    }
  })
);

test(
  'T1 fresh DB: can insert and retrieve sandbox session and pair state',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();

    // Get workspace
    const ws = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
    assert.ok(ws.rows.length > 0, 'Should have workspace after seed');
    const workspaceId = ws.rows[0].id as string;

    // Create session
    const sessionId = 'test-session-fresh-db';
    await db.execute({
      sql: `INSERT INTO playground_sessions (id, workspace_id, user_id, is_sandbox, created_at)
            VALUES (?, ?, 'test-user', 1, datetime('now'))`,
      args: [sessionId, workspaceId],
    });

    // Create sandbox pair state
    const padJson = JSON.stringify({ pleasure: 0, arousal: 0, dominance: 0 });
    const appraisalJson = JSON.stringify({
      goalCongruence: 0, controllability: 0.5, certainty: 0.5,
      normAlignment: 0, attachmentSecurity: 0.5, reciprocity: 0,
      pressureIntrusiveness: 0, novelty: 0.5, selfRelevance: 0.5,
    });
    await db.execute({
      sql: `INSERT INTO sandbox_pair_state
            (session_id, active_phase_id, affinity, trust, intimacy_readiness, conflict, pad_json, pad_fast_json, pad_slow_json, pad_combined_json, appraisal_json, open_thread_count, updated_at)
            VALUES (?, 'first_meeting', 50, 50, 0, 0, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      args: [sessionId, padJson, padJson, padJson, padJson, appraisalJson],
    });

    // Verify retrieval
    const state = await db.execute({
      sql: `SELECT * FROM sandbox_pair_state WHERE session_id = ?`,
      args: [sessionId],
    });
    assert.equal(state.rows.length, 1, 'Should have one pair state row');
    assert.equal(state.rows[0].active_phase_id, 'first_meeting');

    // Create sandbox working memory
    const wmJson = JSON.stringify({
      preferredAddressForm: null,
      knownLikes: [],
      knownDislikes: [],
      currentCooldowns: {},
      activeTensionSummary: null,
      relationshipStance: null,
      knownCorrections: [],
      intimacyContextHints: [],
    });
    await db.execute({
      sql: `INSERT INTO sandbox_working_memory (session_id, data_json, updated_at)
            VALUES (?, ?, datetime('now'))`,
      args: [sessionId, wmJson],
    });

    const wm = await db.execute({
      sql: `SELECT * FROM sandbox_working_memory WHERE session_id = ?`,
      args: [sessionId],
    });
    assert.equal(wm.rows.length, 1, 'Should have one working memory row');
  })
);
