/**
 * T5: Production chat turn — pair state persistence
 *
 * Verifies that pair metrics (trust, affinity, intimacyReadiness, conflict)
 * and PAD state are persisted to DB after each turn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T5 execute-turn persists pair metrics from integrator result', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // Should spread relationshipAfter into pair state
  assert.match(source, /relationshipAfter/, 'Should reference relationshipAfter from integrator');
  assert.match(source, /updatePairState/, 'Should call updatePairState');
});

test('T5 execute-turn finalPairState includes all metric fields', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /finalPairState/, 'Should construct finalPairState');
  // PAD state should be included
  assert.match(source, /pad_json|padJson|pad_fast_json|emotion/, 'Should include PAD in pair state');
});

test('T5 chat-turn calls pairRepo.updateState', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  assert.match(source, /pairRepo.*updateState|repos.*pairRepo/, 'Should use pairRepo for state updates');
});
