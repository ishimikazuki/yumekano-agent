/**
 * T8: Publish from workspace integration test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T8 publishWorkspaceDraft is importable', async () => {
  const { publishWorkspaceDraft } = await import('@/lib/versioning/publish');
  assert.equal(typeof publishWorkspaceDraft, 'function');
});

test('T8 publish API route calls publishWorkspaceDraft', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/app/api/workspaces/[id]/publish/route.ts'),
    'utf8'
  );
  assert.match(source, /publishWorkspaceDraft/, 'API route should use workspace-based publish');
});

test('T8 publishWorkspaceDraft uses workspaceRepo', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/versioning/publish.ts'),
    'utf8'
  );
  assert.match(source, /workspaceRepo/, 'Should use workspaceRepo for workspace-based publish');
});
