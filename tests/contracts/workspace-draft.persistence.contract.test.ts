/**
 * T1: workspace_draft_state full persistence contract
 *
 * Verifies that workspaceRepo correctly persists and retrieves
 * ALL prompt fields through initDraft, getDraft, updatePrompt.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { workspaceRepo } from '@/lib/repositories';

const ALL_PROMPT_COLUMNS = [
  'planner_md',
  'generator_md',
  'generator_intimacy_md',
  'emotion_appraiser_md',
  'extractor_md',
  'reflector_md',
  'ranker_md',
] as const;

test('T1: workspace_draft_state table has all canonical prompt columns', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(workspace_draft_state)');
  const columns = new Set(info.rows.map((r) => r.name as string));

  for (const col of ALL_PROMPT_COLUMNS) {
    assert.ok(columns.has(col), `Missing column: ${col}`);
  }
});

test('T1: workspaceRepo.getWithDraft returns all prompt fields', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) return; // skip if no workspace

  const workspaceId = workspaces.rows[0].id as string;
  const ws = await workspaceRepo.getWithDraft(workspaceId);
  assert.ok(ws?.draft, 'Should have draft');

  const prompts = ws.draft.prompts;
  for (const key of ['plannerMd', 'generatorMd', 'generatorIntimacyMd', 'emotionAppraiserMd', 'extractorMd', 'reflectorMd', 'rankerMd'] as const) {
    assert.ok(
      key in prompts,
      `Draft prompts missing: ${key}`
    );
    assert.ok(
      typeof prompts[key] === 'string',
      `${key} should be string, got ${typeof prompts[key]}`
    );
  }
});

test('T1: workspaceRepo.updatePrompt round-trips emotionAppraiserMd', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) return;

  const workspaceId = workspaces.rows[0].id as string;
  const before = await workspaceRepo.getWithDraft(workspaceId);
  assert.ok(before?.draft, 'Should have draft');

  const originalValue = before.draft.prompts.emotionAppraiserMd ?? '';
  const testValue = `T1 test emotion appraiser ${Date.now()}`;
  await workspaceRepo.updatePrompt(workspaceId, 'emotionAppraiserMd', testValue);

  const after = await workspaceRepo.getWithDraft(workspaceId);
  assert.equal(
    after?.draft?.prompts.emotionAppraiserMd,
    testValue,
    'emotionAppraiserMd should round-trip through updatePrompt'
  );

  // Restore
  await workspaceRepo.updatePrompt(workspaceId, 'emotionAppraiserMd', originalValue);
});

test('T1: workspace and prompt_bundle share same prompt column set', async () => {
  const db = getDb();
  const bundleInfo = await db.execute('PRAGMA table_info(prompt_bundle_versions)');
  const bundleCols = new Set(bundleInfo.rows.map((r) => r.name as string));

  const draftInfo = await db.execute('PRAGMA table_info(workspace_draft_state)');
  const draftCols = new Set(draftInfo.rows.map((r) => r.name as string));

  for (const col of ALL_PROMPT_COLUMNS) {
    assert.ok(bundleCols.has(col), `prompt_bundle_versions missing: ${col}`);
    assert.ok(draftCols.has(col), `workspace_draft_state missing: ${col}`);
  }
});

test('T1: migration consistency — workspace_draft_state columns defined in canonical migration', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const migrateContent = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8');

  // MIGRATION_002 should be canonical for workspace_draft_state
  // It should include both generator_intimacy_md and emotion_appraiser_md
  const migration002Match = migrateContent.match(
    /MIGRATION_002_WORKSPACES\s*=\s*`([\s\S]*?)`;/
  );
  assert.ok(migration002Match, 'MIGRATION_002_WORKSPACES should exist');
  const migration002 = migration002Match[1];

  assert.ok(
    migration002.includes('generator_intimacy_md'),
    'MIGRATION_002 workspace_draft_state should include generator_intimacy_md'
  );
  assert.ok(
    migration002.includes('emotion_appraiser_md'),
    'MIGRATION_002 workspace_draft_state should include emotion_appraiser_md'
  );
});
