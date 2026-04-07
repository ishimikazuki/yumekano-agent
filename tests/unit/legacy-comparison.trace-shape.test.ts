/**
 * T4: Legacy comparison trace shape contract
 *
 * Verifies that:
 * 1. LegacyEmotionComparisonSchema exists as a trace contract type
 * 2. TurnTraceSchema includes legacyComparison as nullable/optional
 * 3. enableLegacyComparison flag is removed (legacy path was deleted)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { LegacyEmotionComparisonSchema, TurnTraceSchema } from '@/lib/schemas';

test('T4: LegacyEmotionComparisonSchema exists as trace contract type', () => {
  assert.ok(LegacyEmotionComparisonSchema, 'Should be importable');
  assert.ok(LegacyEmotionComparisonSchema.shape, 'Should be a Zod object schema');
  assert.ok(LegacyEmotionComparisonSchema.shape.appraisal, 'Should have appraisal field');
  assert.ok(LegacyEmotionComparisonSchema.shape.emotionAfter, 'Should have emotionAfter field');
  assert.ok(LegacyEmotionComparisonSchema.shape.relationshipAfter, 'Should have relationshipAfter field');
  assert.ok(LegacyEmotionComparisonSchema.shape.relationshipDeltas, 'Should have relationshipDeltas field');
});

test('T4: TurnTraceSchema includes legacyComparison as nullable optional', () => {
  assert.ok(TurnTraceSchema.shape.legacyComparison, 'TurnTraceSchema should have legacyComparison field');
  // legacyComparison is nullable optional — null is valid
  const result = TurnTraceSchema.shape.legacyComparison.safeParse(null);
  assert.ok(result.success, 'null should be valid for legacyComparison');
});

test('T4: enableLegacyComparison flag is removed from execute-turn input', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.ok(
    !source.includes('enableLegacyComparison'),
    'enableLegacyComparison should be removed — legacy path was deleted (commit 02b13cd)'
  );
});

test('T4: no vestigial legacy comparison references in call sites', () => {
  const files = [
    'src/mastra/workflows/draft-chat-turn.ts',
    'src/mastra/workflows/chat-turn.ts',
  ];
  for (const file of files) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.ok(
      !source.includes('enableLegacyComparison'),
      `${file} should not reference enableLegacyComparison`
    );
  }
});
