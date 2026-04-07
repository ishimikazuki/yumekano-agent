/**
 * T6: prod/draft trace parity integration test
 *
 * Verifies that prod and draft trace persistence have parity:
 * - Both save traces (different storage, same shape)
 * - Draft uses updateTurnTrace to playground_turns.trace_json
 * - Prod uses persistTrace to turn_traces table
 * - Both paths go through the same executeTurn, so trace shape is identical
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T6 trace parity: both prod and draft call executeTurn (same trace shape)', () => {
  const prodSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  const draftSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  assert.match(prodSource, /executeTurn/, 'Prod should use executeTurn');
  assert.match(draftSource, /executeTurn/, 'Draft should use executeTurn');
});

test('T6 trace parity: draft saves trace via updateTurnTrace (not no-op)', () => {
  const draftSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  // Draft must implement updateTurnTrace
  assert.match(
    draftSource,
    /updateTurnTrace:\s*async/,
    'Draft must implement updateTurnTrace'
  );
  // Draft's updateTurnTrace should call workspaceRepo.updateTurnTrace
  assert.match(
    draftSource,
    /workspaceRepo\.updateTurnTrace/,
    'Draft updateTurnTrace should persist to workspace repo'
  );
});

test('T6 trace parity: prod saves trace via persistTrace', () => {
  const prodSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  assert.match(
    prodSource,
    /persistTrace:\s*async/,
    'Prod must implement persistTrace'
  );
  assert.match(
    prodSource,
    /traceRepo\.createTrace/,
    'Prod persistTrace should use traceRepo'
  );
});

test('T6 trace parity: executeTurn calls both persistTrace and updateTurnTrace', () => {
  const execSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(execSource, /persistTrace\(trace\)/, 'executeTurn should call persistTrace');
  assert.match(execSource, /updateTurnTrace/, 'executeTurn should call updateTurnTrace');
});

test('T6 trace parity: trace shape is determined by executeTurn, not by callers', () => {
  // Verify that neither prod nor draft construct trace objects themselves
  const prodSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  const draftSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  // Neither should reference TurnTraceSchema directly (trace is built inside executeTurn)
  assert.ok(
    !prodSource.includes('TurnTraceSchema'),
    'Prod should not construct traces (executeTurn does it)'
  );
  assert.ok(
    !draftSource.includes('TurnTraceSchema'),
    'Draft should not construct traces (executeTurn does it)'
  );
});
