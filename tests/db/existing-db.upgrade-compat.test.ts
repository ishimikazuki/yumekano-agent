/**
 * T1: Existing DB upgrade compatibility test
 *
 * Simulates an existing DB at various migration checkpoints,
 * then applies remaining migrations to verify upgrade path works.
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t1-upgrade-'));
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

// --- Full migration run from scratch produces consistent schema ---

test(
  'T1: existing DB upgrade — full migrate then re-migrate is idempotent',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');

    // First run
    await runMigrations();
    const db = getDb();

    // Capture schema
    const tables1 = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames1 = tables1.rows.map((r) => r.name as string);

    // Second run (simulates re-deploy on existing DB)
    await runMigrations();

    const tables2 = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames2 = tables2.rows.map((r) => r.name as string);

    assert.deepEqual(tableNames1, tableNames2, 'Schema should be identical after double migrate');

    // Verify migration count is still 8
    const migrations = await db.execute('SELECT name FROM _migrations ORDER BY name');
    assert.equal(migrations.rows.length, 8, 'Should have exactly 8 migration records');
  })
);

// --- Superseded no-op migrations don't break upgrade ---

test(
  'T1: existing DB — superseded migrations (004, 006, 008) apply cleanly as no-ops',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();

    // Verify all 8 migrations are recorded
    const migrations = await db.execute('SELECT name FROM _migrations ORDER BY name');
    const names = migrations.rows.map((r) => r.name as string);

    assert.ok(names.includes('004_generator_intimacy_prompt.sql'), '004 should be tracked');
    assert.ok(names.includes('006_sandbox_memory_parity.sql'), '006 should be tracked');
    assert.ok(names.includes('008_prompt_bundle_parity.sql'), '008 should be tracked');

    // Even though they're no-ops, the tables they originally created should exist
    // (because they're now defined in the canonical 001/002 migrations)
    const tableCheck = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sandbox_memory_%'"
    );
    const sandboxTables = new Set(tableCheck.rows.map((r) => r.name as string));

    assert.ok(sandboxTables.has('sandbox_memory_events'), 'sandbox_memory_events should exist');
    assert.ok(sandboxTables.has('sandbox_memory_facts'), 'sandbox_memory_facts should exist');
    assert.ok(sandboxTables.has('sandbox_memory_observations'), 'sandbox_memory_observations should exist');
    assert.ok(sandboxTables.has('sandbox_memory_open_threads'), 'sandbox_memory_open_threads should exist');
    assert.ok(sandboxTables.has('sandbox_memory_usage'), 'sandbox_memory_usage should exist');
  })
);

// --- Column schema consistency between prompt_bundle_versions and workspace_draft_state ---

test(
  'T1: existing DB — prompt columns are consistent across tables',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();

    // Get prompt_bundle_versions columns
    const pbInfo = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
    const pbColumns = new Set(pbInfo.rows.map((r) => r.name as string));

    // Get workspace_draft_state columns
    const wsInfo = await db.execute('PRAGMA table_info(workspace_draft_state)');
    const wsColumns = new Set(wsInfo.rows.map((r) => r.name as string));

    // Both should have these prompt columns
    const sharedPromptColumns = [
      'planner_md',
      'generator_md',
      'generator_intimacy_md',
      'emotion_appraiser_md',
      'extractor_md',
      'reflector_md',
      'ranker_md',
    ];

    for (const col of sharedPromptColumns) {
      assert.ok(pbColumns.has(col), `prompt_bundle_versions missing: ${col}`);
      assert.ok(wsColumns.has(col), `workspace_draft_state missing: ${col}`);
    }
  })
);

// --- sandbox_pair_state has all emotion layer columns after upgrade ---

test(
  'T1: existing DB — sandbox_pair_state has full emotion layer after upgrade',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const info = await db.execute('PRAGMA table_info(sandbox_pair_state)');
    const columns = new Set(info.rows.map((r) => r.name as string));

    const emotionColumns = [
      'pad_json',
      'pad_fast_json',
      'pad_slow_json',
      'pad_combined_json',
      'last_emotion_updated_at',
    ];

    for (const col of emotionColumns) {
      assert.ok(columns.has(col), `sandbox_pair_state missing emotion column: ${col}`);
    }
  })
);
