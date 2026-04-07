/**
 * T5: Production chat turn — legacy comparison contract
 *
 * The legacy heuristic emotion path was removed (commit 02b13cd).
 * enableLegacyComparison was removed in T4.
 *
 * This test verifies:
 * - legacyComparison field exists in trace schema (for historical data)
 * - legacyComparison is null in new traces (legacy path removed)
 * - enableLegacyComparison is no longer in the codebase
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TurnTraceSchema, LegacyEmotionComparisonSchema } from '@/lib/schemas';

test('T5 trace schema retains legacyComparison field for historical data', () => {
  assert.ok(
    TurnTraceSchema.shape.legacyComparison,
    'TurnTraceSchema should have legacyComparison field'
  );
  // null is valid (legacy path removed)
  const result = TurnTraceSchema.shape.legacyComparison.safeParse(null);
  assert.ok(result.success, 'null should be valid for legacyComparison');
});

test('T5 LegacyEmotionComparisonSchema is still defined for old trace data', () => {
  assert.ok(LegacyEmotionComparisonSchema, 'Schema should exist');
  assert.ok(LegacyEmotionComparisonSchema.shape.appraisal, 'Should have appraisal');
  assert.ok(LegacyEmotionComparisonSchema.shape.emotionAfter, 'Should have emotionAfter');
});

test('T5 execute-turn sets legacyComparison to null', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(
    source,
    /legacyComparison:\s*null/,
    'execute-turn should set legacyComparison to null (legacy path removed)'
  );
});

test('T5 enableLegacyComparison is fully removed from execute-turn', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.ok(
    !source.includes('enableLegacyComparison'),
    'enableLegacyComparison should not exist in execute-turn (removed in T4)'
  );
});
