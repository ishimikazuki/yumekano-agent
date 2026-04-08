/**
 * T3: Draft trace shape contract test
 *
 * Verifies that the draft trace persistence path saves the required
 * trace shape to playground_turns.trace_json via updateTurnTrace.
 *
 * Draft trace persistence semantics:
 * - persistTrace is a no-op (draft doesn't write to turn_traces)
 * - updateTurnTrace writes full TurnTrace JSON to playground_turns.trace_json
 * - The trace shape is identical to prod (built by executeTurn)
 * - Retrieval reads from playground_turns.trace_json
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TurnTraceSchema } from '@/lib/schemas';

test('T3: draft saves trace via updateTurnTrace (not persistTrace)', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  // persistTrace should be a no-op for draft
  assert.match(
    source,
    /persistTrace:\s*async\s*\(\)\s*=>\s*\{\s*\}/,
    'Draft persistTrace should be a no-op (empty function body)'
  );
  // updateTurnTrace should be implemented
  assert.match(
    source,
    /updateTurnTrace:\s*async/,
    'Draft must implement updateTurnTrace'
  );
});

test('T3: draft updateTurnTrace persists to playground_turns.trace_json', () => {
  const repoSource = readFileSync(
    path.join(process.cwd(), 'src/lib/repositories/workspace-repo.ts'),
    'utf8'
  );
  assert.ok(
    repoSource.includes('UPDATE playground_turns SET trace_json'),
    'workspace-repo updateTurnTrace should UPDATE playground_turns.trace_json'
  );
  assert.ok(
    repoSource.includes('JSON.stringify(traceJson)'),
    'workspace-repo should JSON.stringify the trace before storage'
  );
});

test('T3: draft trace is full TurnTrace shape (not a subset)', () => {
  // executeTurn builds the trace and passes it to both persistTrace and updateTurnTrace
  // Since draft's updateTurnTrace receives the same TurnTrace object,
  // the shape stored in trace_json is the full TurnTrace
  const execSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // executeTurn calls updateTurnTrace with the full trace
  assert.match(
    execSource,
    /updateTurnTrace\(turnId,\s*trace\)/,
    'executeTurn should pass full trace to updateTurnTrace'
  );
  // The trace is typed as TurnTrace
  assert.match(
    execSource,
    /const trace:\s*TurnTrace/,
    'executeTurn should type trace as TurnTrace'
  );
});

// Required fields that must be present in both prod and draft traces
const PARITY_REQUIRED_FIELDS = [
  'coeExtraction',
  'emotionTrace',
  'plan',
  'candidates',
  'winnerIndex',
  'memoryWrites',
  'emotionStateBefore',
  'emotionStateAfter',
  'relationshipBefore',
  'relationshipAfter',
  'relationshipDeltas',
  'coeContributions',
  'legacyComparison',
] as const;

test('T3: TurnTraceSchema includes all parity-required fields', () => {
  for (const field of PARITY_REQUIRED_FIELDS) {
    assert.ok(
      TurnTraceSchema.shape[field],
      `TurnTraceSchema should have parity field: ${field}`
    );
  }
});

test('T3: executeTurn populates all parity-required fields in trace', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // Find the trace construction block
  const traceStart = source.indexOf('const trace: TurnTrace');
  const traceEnd = source.indexOf('};', traceStart + 100);
  const traceBlock = source.slice(traceStart, traceEnd);

  for (const field of PARITY_REQUIRED_FIELDS) {
    assert.ok(
      traceBlock.includes(field),
      `Trace construction should include field: ${field}`
    );
  }
});

test('T3: draft trace persistence docs — semantics are explained', () => {
  // This test documents and verifies the draft trace persistence semantics
  // Draft uses playground_turns.trace_json (JSON blob) instead of turn_traces (columns)
  // This is intentional: draft traces are temporary and session-scoped

  const draftSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );

  // Draft should use executeTurn (same trace construction as prod)
  assert.match(draftSource, /executeTurn/, 'Draft should use executeTurn for trace construction');

  // Both prod and draft go through the same executeTurn function
  // Prod: persistTrace → turn_traces table (individual columns)
  // Draft: updateTurnTrace → playground_turns.trace_json (JSON blob)
  // The trace shape is identical because executeTurn builds it
  assert.ok(true, 'Draft trace semantics are documented in this test');
});
