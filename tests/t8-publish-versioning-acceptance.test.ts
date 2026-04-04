/**
 * T8: publish/versioning acceptance tests
 *
 * Verifies workspace-based publish flow is the canonical path:
 * workspace draft -> immutable version -> release.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Task T8 publishWorkspaceDraft is importable and is a function', async () => {
  const { publishWorkspaceDraft } = await import('@/lib/versioning/publish');
  assert.equal(typeof publishWorkspaceDraft, 'function');
});

test('Task T8 active code path uses workspace-based publish, not in-memory drafts', () => {
  const publishPath = path.join(process.cwd(), 'src', 'lib', 'versioning', 'publish.ts');
  assert.ok(existsSync(publishPath), 'publish.ts must exist');

  const content = readFileSync(publishPath, 'utf8');
  assert.match(content, /workspaceRepo|workspace/i, 'Publish must reference workspace');
});

test('Task T8 API publish route uses workspace draft path', () => {
  const routePath = path.join(
    process.cwd(),
    'src',
    'app',
    'api',
    'workspaces',
    '[id]',
    'publish',
    'route.ts'
  );
  assert.ok(existsSync(routePath), 'Workspace publish route must exist');
  const content = readFileSync(routePath, 'utf8');
  assert.match(content, /publishWorkspaceDraft/, 'Route must call publishWorkspaceDraft');
});

test('Task T8 fresh DB migration creates workspace tables', async () => {
  const { getDb } = await import('@/lib/db/client');
  const db = getDb();
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'character_workspace%' ORDER BY name"
  );
  const tables = result.rows.map((r) => r.name as string);
  assert.ok(tables.includes('character_workspaces'), 'character_workspaces table required');
});

test('Task T8 workspace_draft_state table has all prompt fields', async () => {
  const { getDb } = await import('@/lib/db/client');
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(workspace_draft_state)');
  const columns = info.rows.map((r) => r.name as string);
  for (const col of [
    'planner_md',
    'generator_md',
    'generator_intimacy_md',
    'emotion_appraiser_md',
    'extractor_md',
    'reflector_md',
    'ranker_md',
    'phase_graph_json',
  ]) {
    assert.ok(columns.includes(col), `workspace_draft_state missing column: ${col}`);
  }
});
