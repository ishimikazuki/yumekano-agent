import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { evalRepo } from '@/lib/repositories/eval-repo';

test('eval runs allow only one active run per character version', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-eval-lock-'));
  const dbPath = path.join(tempDir, 'eval-lock.db');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLocalDatabaseUrl = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

  try {
    const db = getDb();

    await db.execute(`
      CREATE TABLE characters (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE character_versions (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL REFERENCES characters(id),
        version_number INTEGER NOT NULL,
        status TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE scenario_sets (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL REFERENCES characters(id),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        version INTEGER NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE eval_runs (
        id TEXT PRIMARY KEY,
        scenario_set_id TEXT NOT NULL REFERENCES scenario_sets(id),
        character_version_id TEXT NOT NULL REFERENCES character_versions(id),
        model_registry_snapshot_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        summary_json TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE UNIQUE INDEX idx_eval_runs_one_active_per_version
      ON eval_runs(character_version_id)
      WHERE status IN ('pending', 'running')
    `);

    await db.execute({
      sql: `INSERT INTO characters (id, slug, display_name) VALUES (?, ?, ?)`,
      args: ['11111111-1111-4111-8111-111111111111', 'seira', '蒼井セイラ'],
    });
    await db.execute({
      sql: `INSERT INTO character_versions (id, character_id, version_number, status) VALUES (?, ?, ?, ?)`,
      args: [
        '22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
        1,
        'published',
      ],
    });
    await db.execute({
      sql: `INSERT INTO scenario_sets (id, character_id, name, description, version) VALUES (?, ?, ?, ?, ?)`,
      args: [
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        'Basic Greeting',
        'smoke',
        1,
      ],
    });

    const firstRun = await evalRepo.createRun({
      scenarioSetId: '33333333-3333-4333-8333-333333333333',
      characterVersionId: '22222222-2222-4222-8222-222222222222',
      modelRegistrySnapshot: {},
    });

    await assert.rejects(
      () =>
        evalRepo.createRun({
          scenarioSetId: '33333333-3333-4333-8333-333333333333',
          characterVersionId: '22222222-2222-4222-8222-222222222222',
          modelRegistrySnapshot: {},
        }),
      /unique|constraint/i
    );

    await evalRepo.updateEvalRunStatus(firstRun.id, 'completed');

    const secondRun = await evalRepo.createRun({
      scenarioSetId: '33333333-3333-4333-8333-333333333333',
      characterVersionId: '22222222-2222-4222-8222-222222222222',
      modelRegistrySnapshot: {},
    });

    assert.equal(firstRun.status, 'pending');
    assert.equal(secondRun.status, 'pending');
    assert.notEqual(firstRun.id, secondRun.id);
  } finally {
    await getDb().close();

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousLocalDatabaseUrl === undefined) {
      delete process.env.LOCAL_DATABASE_URL;
    } else {
      process.env.LOCAL_DATABASE_URL = previousLocalDatabaseUrl;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
