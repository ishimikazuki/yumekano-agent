/**
 * T1: prompt_bundle_versions full persistence contract
 *
 * Verifies that promptBundleRepo correctly persists and retrieves
 * ALL prompt fields (not just generatorIntimacyMd).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { promptBundleRepo } from '@/lib/repositories';

const ALL_PROMPT_COLUMNS = [
  'planner_md',
  'generator_md',
  'generator_intimacy_md',
  'emotion_appraiser_md',
  'extractor_md',
  'reflector_md',
  'ranker_md',
] as const;

test('T1: prompt_bundle_versions table has all canonical prompt columns', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
  const columns = new Set(info.rows.map((r) => r.name as string));

  for (const col of ALL_PROMPT_COLUMNS) {
    assert.ok(columns.has(col), `Missing column: ${col}`);
  }
});

test('T1: promptBundleRepo.create round-trips all prompt fields', async () => {
  const db = getDb();
  const chars = await db.execute('SELECT id FROM characters LIMIT 1');
  assert.ok(chars.rows.length > 0, 'Need at least one character');
  const characterId = chars.rows[0].id as string;

  const testPrompts = {
    plannerMd: 'T1 test planner md',
    generatorMd: 'T1 test generator md',
    generatorIntimacyMd: 'T1 test generator intimacy md',
    emotionAppraiserMd: 'T1 test emotion appraiser md',
    extractorMd: 'T1 test extractor md',
    reflectorMd: 'T1 test reflector md',
    rankerMd: 'T1 test ranker md',
  };

  const created = await promptBundleRepo.create({
    characterId,
    prompts: testPrompts,
  });

  assert.ok(created.id, 'Created bundle should have an id');

  // Verify all fields via getById
  const fetched = await promptBundleRepo.getById(created.id);
  assert.ok(fetched, 'Should fetch created bundle');
  assert.equal(fetched.plannerMd, testPrompts.plannerMd);
  assert.equal(fetched.generatorMd, testPrompts.generatorMd);
  assert.equal(fetched.generatorIntimacyMd, testPrompts.generatorIntimacyMd);
  assert.equal(fetched.emotionAppraiserMd, testPrompts.emotionAppraiserMd);
  assert.equal(fetched.extractorMd, testPrompts.extractorMd);
  assert.equal(fetched.reflectorMd, testPrompts.reflectorMd);
  assert.equal(fetched.rankerMd, testPrompts.rankerMd);
});

test('T1: promptBundleRepo.getLatest round-trips all prompt fields', async () => {
  const db = getDb();
  const chars = await db.execute('SELECT id FROM characters LIMIT 1');
  assert.ok(chars.rows.length > 0, 'Need at least one character');
  const characterId = chars.rows[0].id as string;

  const latest = await promptBundleRepo.getLatest(characterId);
  assert.ok(latest, 'Should have at least one bundle');

  // All fields should be present (not undefined)
  for (const key of ['plannerMd', 'generatorMd', 'generatorIntimacyMd', 'emotionAppraiserMd', 'extractorMd', 'reflectorMd', 'rankerMd'] as const) {
    assert.ok(
      key in latest,
      `Latest bundle missing field: ${key}`
    );
    assert.ok(
      typeof (latest as Record<string, unknown>)[key] === 'string',
      `${key} should be a string, got ${typeof (latest as Record<string, unknown>)[key]}`
    );
  }
});

test('T1: promptBundleRepo.list round-trips all prompt fields', async () => {
  const db = getDb();
  const chars = await db.execute('SELECT id FROM characters LIMIT 1');
  assert.ok(chars.rows.length > 0, 'Need at least one character');
  const characterId = chars.rows[0].id as string;

  const list = await promptBundleRepo.list(characterId);
  assert.ok(list.length > 0, 'Should have at least one bundle');

  for (const bundle of list) {
    assert.ok(typeof bundle.generatorIntimacyMd === 'string', 'generatorIntimacyMd should be string');
    assert.ok(typeof bundle.emotionAppraiserMd === 'string', 'emotionAppraiserMd should be string');
  }
});

test('T1: migration consistency — prompt_bundle_versions columns defined once canonically', async () => {
  // Read migrate.ts to check that MIGRATION_001 has the canonical definition
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const migrateContent = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8');

  // MIGRATION_001 should be the canonical source for prompt_bundle_versions
  // It should include generator_intimacy_md and emotion_appraiser_md in the CREATE TABLE
  assert.ok(
    migrateContent.includes("MIGRATION_001_INITIAL") &&
    migrateContent.includes("generator_intimacy_md TEXT NOT NULL DEFAULT ''") &&
    migrateContent.includes("emotion_appraiser_md TEXT NOT NULL DEFAULT ''"),
    'MIGRATION_001 should be canonical and include both generator_intimacy_md and emotion_appraiser_md'
  );
});
