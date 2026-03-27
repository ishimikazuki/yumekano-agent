import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as schemas from '@/lib/schemas';

test('Task T1 CoEEvidence schema matches the repair-plan contract exactly', () => {
  const parsed = schemas.CoEEvidenceSchema.parse({
    acts: ['compliment', 'repair'],
    target: 'assistant',
    polarity: 0.4,
    intensity: 0.8,
    evidenceSpans: ['ありがとう', 'ごめん'],
    confidence: 0.9,
    uncertaintyNotes: ['mixed signal'],
  });

  assert.deepEqual(parsed, {
    acts: ['compliment', 'repair'],
    target: 'assistant',
    polarity: 0.4,
    intensity: 0.8,
    evidenceSpans: ['ありがとう', 'ごめん'],
    confidence: 0.9,
    uncertaintyNotes: ['mixed signal'],
  });
});

test('Task T1 RelationalAppraisal schema matches the repair-plan impact axes', () => {
  const parsed = schemas.RelationalAppraisalSchema.parse({
    warmthImpact: 0.4,
    rejectionImpact: -0.1,
    respectImpact: 0.5,
    threatImpact: -0.4,
    pressureImpact: -0.6,
    repairImpact: 0.7,
    reciprocityImpact: 0.2,
    intimacySignal: 0.3,
    boundarySignal: -0.2,
    certainty: 0.85,
  });

  assert.equal(parsed.warmthImpact, 0.4);
  assert.equal(parsed.boundarySignal, -0.2);
  assert.equal(parsed.certainty, 0.85);
});

test('Task T1 exports EmotionStateDeltaSchema for the planned delta contract', () => {
  assert.ok(
    'EmotionStateDeltaSchema' in schemas,
    'Task T1 requires EmotionStateDeltaSchema to be exported from @/lib/schemas'
  );
});

test('Task T1 keeps the production turn path free of the new CoE pipeline wiring', () => {
  const executeTurnPath = path.join(
    process.cwd(),
    'src',
    'mastra',
    'workflows',
    'execute-turn.ts'
  );
  const executeTurnSource = readFileSync(executeTurnPath, 'utf8');

  assert.equal(
    executeTurnSource.includes('runCoEEvidenceExtractor'),
    false,
    'Task T1 must not wire runCoEEvidenceExtractor into the production turn path yet'
  );
  assert.equal(
    executeTurnSource.includes('integrateCoEAppraisal'),
    false,
    'Task T1 must not wire integrateCoEAppraisal into the production turn path yet'
  );
});
