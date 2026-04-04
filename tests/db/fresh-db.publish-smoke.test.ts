/**
 * T8: Fresh DB publish smoke test
 *
 * Verifies publish flow works on a fresh database after seed.
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
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t8-'));
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
  'T8 fresh DB: seed creates workspace with publishable draft',
  withFreshDb(async (getDb) => {
    const { seed } = await import('@/lib/db/seed');
    await seed();

    const db = getDb();

    // Workspace should exist
    const workspaces = await db.execute('SELECT id FROM character_workspaces');
    assert.ok(workspaces.rows.length > 0, 'Should have workspace');

    // Draft state should exist
    const drafts = await db.execute('SELECT workspace_id FROM workspace_draft_state');
    assert.ok(drafts.rows.length > 0, 'Should have draft state');

    // Releases should exist from seed
    const releases = await db.execute('SELECT id FROM releases');
    assert.ok(releases.rows.length > 0, 'Should have releases from seed');
  })
);
