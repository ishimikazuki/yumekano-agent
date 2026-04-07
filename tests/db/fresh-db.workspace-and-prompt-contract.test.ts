/**
 * T1: Fresh DB workspace and prompt contract test
 *
 * Verifies that on a fresh DB: migrate -> seed -> workspace init
 * all work correctly with ALL prompt fields including
 * generatorIntimacyMd and emotionAppraiserMd.
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t1-'));
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

const PROMPT_COLUMNS = [
  'planner_md',
  'generator_md',
  'generator_intimacy_md',
  'emotion_appraiser_md',
  'extractor_md',
  'reflector_md',
  'ranker_md',
];

test(
  'T1 fresh DB: migrate -> seed creates workspace with all prompt fields',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();

    // Check workspace draft has all prompt columns
    const draftInfo = await db.execute('PRAGMA table_info(workspace_draft_state)');
    const draftCols = new Set(draftInfo.rows.map((r) => r.name as string));
    for (const col of PROMPT_COLUMNS) {
      assert.ok(draftCols.has(col), `workspace_draft_state missing: ${col}`);
    }

    // Check prompt bundle has all prompt columns
    const bundleInfo = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
    const bundleCols = new Set(bundleInfo.rows.map((r) => r.name as string));
    for (const col of PROMPT_COLUMNS) {
      assert.ok(bundleCols.has(col), `prompt_bundle_versions missing: ${col}`);
    }

    // Verify seed data has non-null values for the prompt fields
    const bundles = await db.execute('SELECT * FROM prompt_bundle_versions');
    assert.ok(bundles.rows.length > 0, 'Should have at least one prompt bundle');
    for (const row of bundles.rows) {
      assert.ok(row.generator_intimacy_md !== null, 'generator_intimacy_md should not be null');
      assert.ok(row.emotion_appraiser_md !== null, 'emotion_appraiser_md should not be null');
    }

    // Verify workspace draft has prompt values
    const drafts = await db.execute('SELECT * FROM workspace_draft_state');
    assert.ok(drafts.rows.length > 0, 'Should have at least one workspace draft');
    for (const row of drafts.rows) {
      assert.ok(row.generator_intimacy_md !== null, 'draft generator_intimacy_md should not be null');
      assert.ok(row.emotion_appraiser_md !== null, 'draft emotion_appraiser_md should not be null');
    }
  })
);

test(
  'T1 fresh DB: prompt_bundle and workspace_draft columns are fully aligned',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();

    const bundleInfo = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
    const bundleCols = new Set(bundleInfo.rows.map((r) => r.name as string));

    const draftInfo = await db.execute('PRAGMA table_info(workspace_draft_state)');
    const draftCols = new Set(draftInfo.rows.map((r) => r.name as string));

    for (const col of PROMPT_COLUMNS) {
      assert.ok(bundleCols.has(col), `prompt_bundle_versions missing: ${col}`);
      assert.ok(draftCols.has(col), `workspace_draft_state missing: ${col}`);
    }
  })
);

test(
  'T1 fresh DB: seed prompt bundles include canonical fields with correct types',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();
    const bundles = await db.execute('SELECT * FROM prompt_bundle_versions');

    for (const row of bundles.rows) {
      // All string fields should be non-null strings
      for (const col of PROMPT_COLUMNS) {
        const val = row[col];
        assert.ok(
          typeof val === 'string',
          `${col} should be string, got ${typeof val} for bundle ${row.id}`
        );
      }
    }
  })
);
