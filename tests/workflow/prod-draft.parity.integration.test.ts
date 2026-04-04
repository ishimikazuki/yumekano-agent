/**
 * T6: Production / Draft parity integration test
 *
 * Verifies that prod and draft use the same core pipeline.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T6 prod and draft both use executeTurn', () => {
  const chatTurn = readFileSync(path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'), 'utf8');
  const draftTurn = readFileSync(path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'), 'utf8');
  assert.match(chatTurn, /executeTurn/, 'Production should use executeTurn');
  assert.match(draftTurn, /executeTurn/, 'Draft should use executeTurn');
});

test('T6 prod and draft both use integrateCoEAppraisal via executeTurn', () => {
  const executeTurnSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(executeTurnSource, /integrateCoEAppraisal/, 'Shared executeTurn should use CoE integrator');
});

test('T6 prod and draft use same memory retrieval', () => {
  const executeTurnSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(executeTurnSource, /retrieveMemory/, 'Should use shared retrieveMemory');
});
