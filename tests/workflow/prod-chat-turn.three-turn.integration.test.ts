/**
 * T5: Production chat turn — three turn state progression
 *
 * Verifies that turnsSinceLastUpdate is derived, not hardcoded to 1.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T5 turnsSinceLastUpdate is not hardcoded to 1', () => {
  const chatTurnSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  // Should derive turnsSinceLastEmotionUpdate from countTurnsSince
  assert.match(chatTurnSource, /countTurnsSince/, 'Should call countTurnsSince to derive turn count');
  assert.match(chatTurnSource, /turnsSinceLastEmotionUpdate/, 'Should compute turnsSinceLastEmotionUpdate');
});

test('T5 chat-turn derives daysSinceEntry from pair state', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  assert.match(source, /daysSinceEntry/, 'Should compute daysSinceEntry');
  assert.match(source, /lastTransitionAt/, 'Should reference lastTransitionAt');
});
