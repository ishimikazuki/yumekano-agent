/**
 * T1: Fresh DB workspace prompt contract test
 *
 * Verifies that on a fresh DB: migrate -> seed -> workspace init -> prompt update
 * all work correctly with generatorIntimacyMd.
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

test(
  'T1 fresh DB: migrate -> seed -> workspace has generatorIntimacyMd',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();

    // Check workspace draft has generator_intimacy_md
    const drafts = await db.execute('SELECT generator_intimacy_md FROM workspace_draft_state');
    assert.ok(drafts.rows.length > 0, 'Should have at least one workspace draft');
    for (const row of drafts.rows) {
      assert.ok(
        row.generator_intimacy_md !== undefined,
        'generator_intimacy_md should exist in draft'
      );
    }

    // Check prompt bundles have generator_intimacy_md
    const bundles = await db.execute('SELECT generator_intimacy_md FROM prompt_bundle_versions');
    assert.ok(bundles.rows.length > 0, 'Should have at least one prompt bundle');
    for (const row of bundles.rows) {
      assert.ok(
        row.generator_intimacy_md !== undefined,
        'generator_intimacy_md should exist in bundle'
      );
    }
  })
);

test(
  'T1 fresh DB: prompt bundle and workspace draft columns are aligned',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();

    const bundleInfo = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
    const bundleCols = new Set(bundleInfo.rows.map((r) => r.name as string));

    const draftInfo = await db.execute('PRAGMA table_info(workspace_draft_state)');
    const draftCols = new Set(draftInfo.rows.map((r) => r.name as string));

    // Both should have the same prompt columns
    const sharedPromptCols = [
      'planner_md',
      'generator_md',
      'generator_intimacy_md',
      'emotion_appraiser_md',
      'extractor_md',
      'reflector_md',
      'ranker_md',
    ];

    for (const col of sharedPromptCols) {
      assert.ok(bundleCols.has(col), `prompt_bundle_versions missing: ${col}`);
      assert.ok(draftCols.has(col), `workspace_draft_state missing: ${col}`);
    }
  })
);
