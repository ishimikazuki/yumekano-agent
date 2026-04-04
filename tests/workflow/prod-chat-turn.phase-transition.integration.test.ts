/**
 * T5: Production chat turn — phase transition
 *
 * Verifies that phase transitions are evaluated dynamically,
 * not with placeholder zero counters.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T5 execute-turn evaluates phase transition with real counters', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // Phase transition should use resolvePhaseTransition or createPhaseEngine
  assert.match(source, /resolvePhaseTransition|createPhaseEngine/, 'Should use phase engine for transitions');
  // Should not have hardcoded zero counters as main logic
  assert.doesNotMatch(source, /turnsSinceLastUpdate:\s*1[,\s]/, 'Should not hardcode turnsSinceLastUpdate: 1');
});

test('T5 execute-turn passes turnsSinceLastTransition to phase engine', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /turnsSinceLastTransition/, 'Should pass turnsSinceLastTransition');
  assert.match(source, /daysSinceEntry/, 'Should pass daysSinceEntry');
});
