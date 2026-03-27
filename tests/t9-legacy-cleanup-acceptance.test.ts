import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

test('Task T9 execute-turn no longer references the legacy heuristic appraisal runtime path', async () => {
  const source = await readFile(
    path.join(ROOT, 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );

  assert.equal(source.includes('computeAppraisal('), false);
  assert.equal(source.includes('updatePAD('), false);
});

test('Task T9 rollback plan is documented with explicit feature-flag instructions', async () => {
  const rollbackDoc = await readFile(
    path.join(ROOT, 'docs/COE_ROLLBACK_PLAN.md'),
    'utf8'
  );

  assert.match(rollbackDoc, /YUMEKANO_USE_COE_INTEGRATOR/);
  assert.match(rollbackDoc, /rollback/i);
  assert.match(rollbackDoc, /1\./);
  assert.match(rollbackDoc, /2\./);
});
