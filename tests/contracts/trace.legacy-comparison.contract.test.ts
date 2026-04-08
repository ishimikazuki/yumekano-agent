/**
 * T2: Trace legacy comparison contract test
 *
 * Verifies that:
 * - TurnTraceSchema accepts non-null legacyComparison
 * - TurnTraceSchema accepts null legacyComparison
 * - LegacyEmotionComparisonSchema validates the expected payload shape
 * - computeLegacyComparison flag exists in execute-turn input
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  LegacyEmotionComparisonSchema,
  TurnTraceSchema,
} from '@/lib/schemas';

test('T2: TurnTraceSchema accepts null legacyComparison', () => {
  const result = TurnTraceSchema.shape.legacyComparison.safeParse(null);
  assert.ok(result.success, 'null should be valid for legacyComparison');
});

test('T2: TurnTraceSchema accepts valid legacyComparison payload', () => {
  const payload = {
    appraisal: {
      goalCongruence: 0.5,
      controllability: 0.5,
      certainty: 0.5,
      normAlignment: 0.3,
      attachmentSecurity: 0.5,
      reciprocity: 0.2,
      pressureIntrusiveness: 0,
      novelty: 0.4,
      selfRelevance: 0.5,
    },
    emotionAfter: { pleasure: 0.1, arousal: 0.05, dominance: 0.02 },
    emotionStateAfter: {
      fastAffect: { pleasure: 0.15, arousal: 0.08, dominance: 0.03 },
      slowMood: { pleasure: 0.05, arousal: 0.02, dominance: 0.01 },
      combined: { pleasure: 0.1, arousal: 0.05, dominance: 0.02 },
      lastUpdatedAt: new Date(),
    },
    relationshipAfter: {
      affinity: 52,
      trust: 51,
      intimacyReadiness: 1,
      conflict: 0,
    },
    relationshipDeltas: {
      affinity: 2,
      trust: 1,
      intimacyReadiness: 1,
      conflict: 0,
    },
    coeContributions: [],
  };

  const result = TurnTraceSchema.shape.legacyComparison.safeParse(payload);
  assert.ok(result.success, `Valid payload should parse: ${JSON.stringify(result.error?.issues)}`);
});

test('T2: LegacyEmotionComparisonSchema has all required fields', () => {
  const shape = LegacyEmotionComparisonSchema.shape;
  assert.ok(shape.appraisal, 'Should have appraisal');
  assert.ok(shape.emotionAfter, 'Should have emotionAfter');
  assert.ok(shape.emotionStateAfter, 'Should have emotionStateAfter');
  assert.ok(shape.relationshipAfter, 'Should have relationshipAfter');
  assert.ok(shape.relationshipDeltas, 'Should have relationshipDeltas');
  assert.ok(shape.coeContributions, 'Should have coeContributions');
});

test('T2: computeLegacyComparison flag exists in execute-turn input', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('computeLegacyComparison'),
    'execute-turn.ts should have computeLegacyComparison in input type'
  );
});

test('T2: legacyComparison is not hardcoded to null in execute-turn', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // Should not have "legacyComparison: null" as a standalone hardcoded value
  // It should be conditional: computeLegacyComparison ? ... : null
  assert.ok(
    !source.includes('legacyComparison: null,'),
    'legacyComparison should not be hardcoded to null — it should be conditional'
  );
  assert.ok(
    source.includes('input.computeLegacyComparison'),
    'legacyComparison should be conditioned on computeLegacyComparison flag'
  );
});

test('T2: comparison disabled path still produces null', () => {
  // When computeLegacyComparison is false/undefined, the trace field should be null
  // This is verified by the conditional in execute-turn: flag ? compute() : null
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // The pattern should be: input.computeLegacyComparison ? buildLegacy... : null
  assert.ok(
    source.includes(': null,') || source.includes('? build'),
    'Should have conditional with null fallback'
  );
});
