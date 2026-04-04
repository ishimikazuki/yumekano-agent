/**
 * T1: prompt_bundle_versions generatorIntimacyMd round-trip contract
 *
 * Verifies that promptBundleRepo correctly persists and retrieves
 * the generatorIntimacyMd field.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { promptBundleRepo } from '@/lib/repositories';

test('T1 prompt_bundle_versions table has generator_intimacy_md column', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
  const columns = info.rows.map((r) => r.name as string);
  assert.ok(columns.includes('generator_intimacy_md'), 'Missing generator_intimacy_md column');
});

test('T1 promptBundleRepo.create persists generatorIntimacyMd', async () => {
  const db = getDb();

  // Get an existing character to reference
  const chars = await db.execute('SELECT id FROM characters LIMIT 1');
  assert.ok(chars.rows.length > 0, 'Need at least one character for test');
  const characterId = chars.rows[0].id as string;

  const created = await promptBundleRepo.create({
    characterId,
    prompts: {
      plannerMd: 'test planner',
      generatorMd: 'test generator',
      generatorIntimacyMd: 'custom intimacy prompt for T1 test',
      emotionAppraiserMd: '',
      extractorMd: 'test extractor',
      reflectorMd: 'test reflector',
      rankerMd: 'test ranker',
    },
  });

  assert.ok(created.id, 'Created bundle should have an id');

  const fetched = await promptBundleRepo.getById(created.id);
  assert.ok(fetched, 'Should be able to fetch created bundle');
  assert.equal(
    fetched.generatorIntimacyMd,
    'custom intimacy prompt for T1 test',
    'generatorIntimacyMd should round-trip'
  );
});

test('T1 promptBundleRepo.getLatest returns generatorIntimacyMd', async () => {
  const db = getDb();
  const chars = await db.execute('SELECT id FROM characters LIMIT 1');
  const characterId = chars.rows[0].id as string;

  const latest = await promptBundleRepo.getLatest(characterId);
  assert.ok(latest, 'Should have at least one bundle');
  assert.ok(
    'generatorIntimacyMd' in latest,
    'Latest bundle should include generatorIntimacyMd field'
  );
});
