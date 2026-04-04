/**
 * T0: Fresh DB seed smoke test
 *
 * Verifies that seed data is correctly inserted after migrations.
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t0-seed-'));
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
  'fresh DB: seed creates expected characters',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();
    const chars = await db.execute('SELECT slug, display_name FROM characters ORDER BY slug');
    const slugs = chars.rows.map((r) => r.slug as string);
    assert.ok(slugs.includes('misaki'), 'Misaki character should be seeded');
    assert.ok(slugs.includes('seira'), 'Seira character should be seeded');
  })
);

test(
  'fresh DB: seed creates prompt bundles',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();
    const bundles = await db.execute('SELECT id FROM prompt_bundle_versions');
    assert.ok(bundles.rows.length >= 2, 'At least 2 prompt bundles should exist');
  })
);

test(
  'fresh DB: seed creates phase graphs, versions, and releases',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();
    const graphs = await db.execute('SELECT id FROM phase_graph_versions');
    assert.ok(graphs.rows.length >= 2, 'At least 2 phase graphs should exist');

    const versions = await db.execute('SELECT id FROM character_versions');
    assert.ok(versions.rows.length >= 2, 'At least 2 character versions should exist');

    const releases = await db.execute('SELECT id FROM releases');
    assert.ok(releases.rows.length >= 2, 'At least 2 releases should exist');
  })
);

test(
  'fresh DB: seed creates workspace for Seira',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();
    const workspaces = await db.execute('SELECT id FROM character_workspaces');
    assert.ok(workspaces.rows.length >= 1, 'At least 1 workspace should exist');
  })
);
