/**
 * T0: Fresh DB smoke test
 *
 * Verifies that migrations and seed run cleanly on a fresh database.
 * This is a gate for all subsequent tickets.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Expected tables after all migrations (001-008)
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

test('fresh DB: migrate creates all expected tables', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-db-smoke-'));
  const dbPath = path.join(tempDir, 'smoke.db');
  const prevDatabase = process.env.DATABASE_URL;
  const prevLocal = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;

  // Force fresh client
  const { getDb } = await import('@/lib/db/client');
  await getDb().close();

  try {
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
  } finally {
    await getDb().close();
    restoreEnv('DATABASE_URL', prevDatabase);
    restoreEnv('LOCAL_DATABASE_URL', prevLocal);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fresh DB: migrate + seed creates characters', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-db-smoke-seed-'));
  const dbPath = path.join(tempDir, 'smoke-seed.db');
  const prevDatabase = process.env.DATABASE_URL;
  const prevLocal = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;

  const { getDb } = await import('@/lib/db/client');
  await getDb().close();

  try {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();

    // Verify characters were created
    const chars = await db.execute('SELECT slug, display_name FROM characters ORDER BY slug');
    const slugs = chars.rows.map((r) => r.slug as string);
    assert.ok(slugs.includes('misaki'), 'Misaki character should be seeded');
    assert.ok(slugs.includes('seira'), 'Seira character should be seeded');

    // Verify prompt bundles exist
    const bundles = await db.execute('SELECT id FROM prompt_bundle_versions');
    assert.ok(bundles.rows.length >= 2, 'At least 2 prompt bundles should exist');

    // Verify phase graphs exist
    const graphs = await db.execute('SELECT id FROM phase_graph_versions');
    assert.ok(graphs.rows.length >= 2, 'At least 2 phase graphs should exist');

    // Verify character versions exist
    const versions = await db.execute('SELECT id FROM character_versions');
    assert.ok(versions.rows.length >= 2, 'At least 2 character versions should exist');

    // Verify releases exist
    const releases = await db.execute('SELECT id FROM releases');
    assert.ok(releases.rows.length >= 2, 'At least 2 releases should exist');

    // Verify workspace for Seira
    const workspaces = await db.execute('SELECT id FROM character_workspaces');
    assert.ok(workspaces.rows.length >= 1, 'At least 1 workspace should exist');

    // Verify migrations are tracked
    const migrations = await db.execute('SELECT name FROM _migrations ORDER BY name');
    assert.ok(
      migrations.rows.length >= 8,
      `Expected at least 8 migrations, got ${migrations.rows.length}`
    );
  } finally {
    await getDb().close();
    restoreEnv('DATABASE_URL', prevDatabase);
    restoreEnv('LOCAL_DATABASE_URL', prevLocal);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fresh DB: migrate is idempotent (double run)', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-db-smoke-idem-'));
  const dbPath = path.join(tempDir, 'smoke-idem.db');
  const prevDatabase = process.env.DATABASE_URL;
  const prevLocal = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;

  const { getDb } = await import('@/lib/db/client');
  await getDb().close();

  try {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();
    // Second run should not throw
    await runMigrations();

    const db = getDb();
    const migrations = await db.execute('SELECT name FROM _migrations');
    assert.ok(migrations.rows.length >= 8, 'Migrations should still be tracked after double run');
  } finally {
    await getDb().close();
    restoreEnv('DATABASE_URL', prevDatabase);
    restoreEnv('LOCAL_DATABASE_URL', prevLocal);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
