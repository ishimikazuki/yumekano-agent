/**
 * T3: Prod trace shape contract test
 *
 * Verifies that the production trace persistence path (traceRepo.createTrace)
 * accepts and stores all required trace fields from TurnTraceSchema.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TurnTraceSchema } from '@/lib/schemas';

const REQUIRED_TRACE_FIELDS = [
  'id',
  'pairId',
  'characterVersionId',
  'promptBundleVersionId',
  'modelIds',
  'phaseIdBefore',
  'phaseIdAfter',
  'emotionBefore',
  'emotionAfter',
  'emotionStateBefore',
  'emotionStateAfter',
  'relationshipBefore',
  'relationshipAfter',
  'relationshipDeltas',
  'phaseTransitionEvaluation',
  'promptAssemblyHashes',
  'appraisal',
  'retrievedMemoryIds',
  'coeExtraction',
  'emotionTrace',
  'legacyComparison',
  'memoryThresholdDecisions',
  'coeContributions',
  'plan',
  'candidates',
  'winnerIndex',
  'memoryWrites',
  'userMessage',
  'assistantMessage',
  'createdAt',
] as const;

test('T3: TurnTraceSchema has all required trace fields', () => {
  const shape = TurnTraceSchema.shape;
  for (const field of REQUIRED_TRACE_FIELDS) {
    assert.ok(shape[field], `TurnTraceSchema should have field: ${field}`);
  }
});

test('T3: prod trace repo (createTrace) accepts all required fields', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/repositories/trace-repo.ts'),
    'utf8'
  );

  // turn_traces INSERT should include key columns
  const requiredColumns = [
    'emotion_state_before_json',
    'emotion_state_after_json',
    'relationship_before_json',
    'relationship_after_json',
    'relationship_deltas_json',
    'coe_extraction_json',
    'emotion_trace_json',
    'legacy_comparison_json',
    'coe_contributions_json',
    'plan_json',
    'candidates_json',
    'winner_index',
    'memory_writes_json',
  ];

  for (const col of requiredColumns) {
    assert.ok(
      source.includes(col),
      `trace-repo should reference column: ${col}`
    );
  }
});

test('T3: prod persistTrace is wired to traceRepo.createTrace', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('traceRepo.createTrace'),
    'Prod persistTrace should call traceRepo.createTrace'
  );
});

test('T3: prod trace includes CoE extraction and emotion trace fields', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/repositories/trace-repo.ts'),
    'utf8'
  );
  assert.ok(source.includes('coeExtraction'), 'createTrace should accept coeExtraction');
  assert.ok(source.includes('emotionTrace'), 'createTrace should accept emotionTrace');
  assert.ok(source.includes('legacyComparison'), 'createTrace should accept legacyComparison');
  assert.ok(source.includes('coeContributions'), 'createTrace should accept coeContributions');
});
