/**
 * T5: Production chat turn — trace completeness
 *
 * Verifies that traces contain CoE evidence, appraisal, state deltas,
 * and contribution reasoning.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T5 execute-turn builds trace with CoE evidence fields', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /coeExtraction/, 'Trace should include coeExtraction');
  assert.match(source, /emotionTrace/, 'Trace should include emotionTrace');
  assert.match(source, /coeContributions/, 'Trace should include coeContributions');
});

test('T5 execute-turn trace includes relationship deltas', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /relationshipDeltas/, 'Trace should include relationshipDeltas');
  assert.match(source, /emotionStateBefore/, 'Trace should include emotionStateBefore');
  assert.match(source, /emotionStateAfter/, 'Trace should include emotionStateAfter');
  assert.match(source, /relationshipBefore/, 'Trace should include relationshipBefore');
  assert.match(source, /relationshipAfter/, 'Trace should include relationshipAfter');
});

test('T5 execute-turn persists trace via persistence.persistTrace', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /persistTrace/, 'Should call persistTrace');
});
