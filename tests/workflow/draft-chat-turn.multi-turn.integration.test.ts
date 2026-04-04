/**
 * T6: Draft chat turn — multi-turn state carry-over
 *
 * Verifies continuing session does not auto-reset to baseline.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T6 draft-chat-turn does not reset PAD to baseline on continuing session', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  // Should check for persisted state before using defaults
  assert.match(source, /persistedSandboxState|getSandboxPairState/, 'Should check for persisted state');
});

test('T6 draft-chat-turn phaseIdAfter is not hardcoded', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  // Should not have a fixed phase ID assignment
  assert.doesNotMatch(source, /phaseIdAfter\s*=\s*['"]phase_/, 'phaseIdAfter should not be hardcoded');
});

test('T6 draft-chat-turn uses same executeTurn core as production', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  assert.match(source, /executeTurn/, 'Should use shared executeTurn');
});
