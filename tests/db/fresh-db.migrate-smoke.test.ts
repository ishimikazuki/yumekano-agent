/**
 * T0: Fresh DB migration smoke test
 *
 * Verifies that all migrations run cleanly on a fresh database
 * and produce the expected table structure.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const EXPECTED_TABLES = [
  'characters',
  'character_versions',
  'phase_graph_versions',
  'prompt_bundle_versions',
  'releases',
  'pairs',
  'pair_state',
  'chat_turns',
  'memory_events',
  'memory_facts',
  'memory_observations',
  'memory_open_threads',
  'memory_usage',
  'scenario_sets',
  'scenario_cases',
  'eval_runs',
  'eval_case_results',
  'turn_traces',
  'working_memory',
  'character_workspaces',
  'workspace_draft_state',
  'workspace_autosaves',
  'workspace_editor_context',
  'playground_sessions',
  'playground_turns',
  'sandbox_pair_state',
  'sandbox_working_memory',
  'sandbox_memory_events',
  'sandbox_memory_facts',
  'sandbox_memory_observations',
  'sandbox_memory_open_threads',
  'sandbox_memory_usage',
  '_migrations',
];

function withFreshDb(
  fn: (getDb: () => ReturnType<typeof import('@/lib/db/client').getDb>) => Promise<void>
) {
  return async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t0-migrate-'));
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

test(
  'fresh DB: migrate creates all expected tables',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = result.rows.map((r) => r.name as string).sort();

    for (const expected of EXPECTED_TABLES) {
      assert.ok(
        tableNames.includes(expected),
        `Missing table after migration: ${expected}. Got: ${tableNames.join(', ')}`
      );
    }
  })
);

test(
  'fresh DB: migrate is idempotent (double run)',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();
    await runMigrations();

    const db = getDb();
    const migrations = await db.execute('SELECT name FROM _migrations');
    assert.ok(migrations.rows.length >= 8, 'Migrations should still be tracked after double run');
  })
);

test(
  'fresh DB: all 8 migrations are tracked',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const migrations = await db.execute('SELECT name FROM _migrations ORDER BY name');
    assert.equal(migrations.rows.length, 8, `Expected 8 migrations, got ${migrations.rows.length}`);
  })
);
