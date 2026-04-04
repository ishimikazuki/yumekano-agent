/**
 * T1: workspace_draft_state generatorIntimacyMd round-trip contract
 *
 * Verifies that workspaceRepo correctly persists and retrieves
 * the generatorIntimacyMd field in workspace drafts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { workspaceRepo } from '@/lib/repositories';

test('T1 workspace_draft_state table has generator_intimacy_md column', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(workspace_draft_state)');
  const columns = info.rows.map((r) => r.name as string);
  assert.ok(columns.includes('generator_intimacy_md'), 'Missing generator_intimacy_md column');
});

test('T1 workspaceRepo.getWithDraft returns generatorIntimacyMd', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) {
    // Skip if no workspace exists (seed not run)
    return;
  }

  const workspaceId = workspaces.rows[0].id as string;
  const workspace = await workspaceRepo.getWithDraft(workspaceId);
  assert.ok(workspace, 'Workspace should exist');
  assert.ok(workspace.draft, 'Workspace should have a draft');
  assert.ok(
    'generatorIntimacyMd' in workspace.draft.prompts,
    'Draft prompts should include generatorIntimacyMd'
  );
});

test('T1 workspaceRepo.updatePrompt round-trips generatorIntimacyMd', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) return;

  const workspaceId = workspaces.rows[0].id as string;
  const before = await workspaceRepo.getWithDraft(workspaceId);
  assert.ok(before?.draft, 'Should have draft');

  const originalValue = before.draft.prompts.generatorIntimacyMd ?? '';
  const testValue = `T1 test intimacy prompt ${Date.now()}`;
  await workspaceRepo.updatePrompt(workspaceId, 'generatorIntimacyMd', testValue);

  const after = await workspaceRepo.getWithDraft(workspaceId);
  assert.equal(
    after?.draft?.prompts.generatorIntimacyMd,
    testValue,
    'generatorIntimacyMd should round-trip through updatePrompt'
  );

  // Restore original value
  await workspaceRepo.updatePrompt(workspaceId, 'generatorIntimacyMd', originalValue);
});
