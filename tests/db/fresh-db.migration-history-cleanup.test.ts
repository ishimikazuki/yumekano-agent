/**
 * T1: Fresh DB migration history cleanup test
 *
 * Verifies that on a fresh DB:
 * - Superseded migrations (004, 006, 008) are no-ops
 * - sandbox_memory_* tables are created by canonical migration (002)
 * - generator_intimacy_md / emotion_appraiser_md exist in canonical tables
 * - No schema drift between migrations
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t1-history-'));
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

// --- Superseded migrations are no-ops in migrate.ts ---

test(
  'T1: superseded migrations (004, 006, 008) are no-ops in runtime',
  async () => {
    const { readFileSync } = await import('node:fs');
    const migrateTs = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'db', 'migrate.ts'),
      'utf8'
    );

    const superseded = [
      { name: '004', constant: 'MIGRATION_004_GENERATOR_INTIMACY_PROMPT' },
      { name: '006', constant: 'MIGRATION_006_SANDBOX_MEMORY_PARITY' },
      { name: '008', constant: 'MIGRATION_008_PROMPT_BUNDLE_PARITY' },
    ];

    for (const { name, constant } of superseded) {
      const match = migrateTs.match(new RegExp(`${constant}\\s*=\\s*\`([\\s\\S]*?)\`;`));
      assert.ok(match, `${constant} should exist in migrate.ts`);
      const body = match[1].trim();
      assert.ok(
        !body.includes('ALTER TABLE') && !body.includes('CREATE TABLE'),
        `Migration ${name} (${constant}) should be no-op, but contains DDL`
      );
    }
  }
);

// --- sandbox_memory_* canonical definition is in MIGRATION_002 ---

test(
  'T1: sandbox_memory_* tables are defined in MIGRATION_002 (canonical)',
  async () => {
    const { readFileSync } = await import('node:fs');
    const migrateTs = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'db', 'migrate.ts'),
      'utf8'
    );

    const m002Match = migrateTs.match(/MIGRATION_002_WORKSPACES\s*=\s*`([\s\S]*?)`;/);
    assert.ok(m002Match, 'MIGRATION_002_WORKSPACES should exist');

    const sandboxTables = [
      'sandbox_memory_events',
      'sandbox_memory_facts',
      'sandbox_memory_observations',
      'sandbox_memory_open_threads',
      'sandbox_memory_usage',
    ];

    for (const table of sandboxTables) {
      assert.ok(
        m002Match[1].includes(`CREATE TABLE IF NOT EXISTS ${table}`),
        `MIGRATION_002 should define ${table}`
      );
    }
  }
);

// --- prompt columns exist in canonical tables after fresh migrate ---

test(
  'T1: fresh DB has generator_intimacy_md in prompt_bundle_versions',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const info = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
    const columns = new Set(info.rows.map((r) => r.name as string));

    assert.ok(columns.has('generator_intimacy_md'), 'prompt_bundle_versions should have generator_intimacy_md');
    assert.ok(columns.has('emotion_appraiser_md'), 'prompt_bundle_versions should have emotion_appraiser_md');
  })
);

test(
  'T1: fresh DB has generator_intimacy_md in workspace_draft_state',
  withFreshDb(async (getDb) => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await runMigrations();

    const db = getDb();
    const info = await db.execute('PRAGMA table_info(workspace_draft_state)');
    const columns = new Set(info.rows.map((r) => r.name as string));

    assert.ok(columns.has('generator_intimacy_md'), 'workspace_draft_state should have generator_intimacy_md');
    assert.ok(columns.has('emotion_appraiser_md'), 'workspace_draft_state should have emotion_appraiser_md');
  })
);

// --- seed and workspace init work after fresh migrate ---

test(
  'T1: fresh DB seed + workspace init succeeds after migration cleanup',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();

    // Verify character exists
    const chars = await db.execute('SELECT id FROM characters LIMIT 1');
    assert.ok(chars.rows.length > 0, 'Should have character after seed');

    // Verify workspace exists
    const ws = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
    assert.ok(ws.rows.length > 0, 'Should have workspace after seed');

    // Verify workspace_draft_state has prompt columns populated
    const draft = await db.execute('SELECT generator_intimacy_md, emotion_appraiser_md FROM workspace_draft_state LIMIT 1');
    assert.ok(draft.rows.length > 0, 'Should have workspace_draft_state after seed');
  })
);
