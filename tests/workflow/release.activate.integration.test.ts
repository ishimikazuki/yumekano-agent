/**
 * T8: Release activation test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('T8 releaseRepo is importable with getCurrent', async () => {
  const { releaseRepo } = await import('@/lib/repositories');
  assert.equal(typeof releaseRepo.getCurrent, 'function');
});

test('T8 releaseRepo.create exists for activation', async () => {
  const { releaseRepo } = await import('@/lib/repositories');
  assert.equal(typeof releaseRepo.create, 'function');
});

test('T8 rollback route exists', async () => {
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const routePath = join(
    process.cwd(),
    'src/app/api/characters/[id]/versions/[versionId]/rollback/route.ts'
  );
  assert.ok(existsSync(routePath), 'Rollback API route should exist');
});
