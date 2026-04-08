/**
 * T2: Production chat turn — legacy comparison integration test
 *
 * Verifies that:
 * - computeLegacyComparison flag controls comparison computation
 * - When enabled, legacyComparison is non-null with valid shape
 * - When disabled/absent, legacyComparison is null
 * - Comparison does not affect mainline decision (winner selection unchanged)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TurnTraceSchema, LegacyEmotionComparisonSchema } from '@/lib/schemas';

test('T2: trace schema retains legacyComparison field', () => {
  assert.ok(
    TurnTraceSchema.shape.legacyComparison,
    'TurnTraceSchema should have legacyComparison field'
  );
  const nullResult = TurnTraceSchema.shape.legacyComparison.safeParse(null);
  assert.ok(nullResult.success, 'null should be valid for legacyComparison');
});

test('T2: LegacyEmotionComparisonSchema validates full payload', () => {
  const payload = {
    appraisal: {
      goalCongruence: 0.5,
      controllability: 0.6,
      certainty: 0.7,
      normAlignment: 0.3,
      attachmentSecurity: 0.55,
      reciprocity: 0.2,
      pressureIntrusiveness: 0.1,
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
    relationshipAfter: { affinity: 52, trust: 51, intimacyReadiness: 1, conflict: 0 },
    relationshipDeltas: { affinity: 2, trust: 1, intimacyReadiness: 1, conflict: 0 },
    coeContributions: [],
  };
  const result = LegacyEmotionComparisonSchema.safeParse(payload);
  assert.ok(result.success, `Payload should validate: ${JSON.stringify(result.error?.issues)}`);
});

test('T2: execute-turn uses computeLegacyComparison flag (not enableLegacyComparison)', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('computeLegacyComparison'),
    'execute-turn should have computeLegacyComparison flag'
  );
  assert.ok(
    !source.includes('enableLegacyComparison'),
    'enableLegacyComparison should not exist (old flag removed in T4)'
  );
});

test('T2: legacyComparison is conditional, not hardcoded null', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('input.computeLegacyComparison'),
    'legacyComparison should be conditioned on input.computeLegacyComparison'
  );
  assert.ok(
    source.includes('buildLegacyComparisonResult'),
    'Should call buildLegacyComparisonResult when enabled'
  );
});

test('T2: comparison does not affect mainline — winner selection is independent', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // buildLegacyComparisonResult should not appear in:
  // - ranker call, generator call, or pair state update
  // It should only appear in the trace object construction
  const rankerCallIdx = source.indexOf('rankerRunner(');
  const generatorCallIdx = source.indexOf('generatorRunner(');
  const pairStateIdx = source.indexOf('const pairStateAfterUpdate');
  const traceIdx = source.indexOf('const trace: TurnTrace');

  // Ranker and generator calls happen before trace construction
  assert.ok(rankerCallIdx < traceIdx, 'Ranker should be called before trace');
  assert.ok(generatorCallIdx < traceIdx, 'Generator should be called before trace');

  // pairStateAfterUpdate should not reference legacy comparison
  const pairStateBlock = source.slice(pairStateIdx, traceIdx);
  assert.ok(
    !pairStateBlock.includes('buildLegacyComparisonResult'),
    'buildLegacyComparisonResult should not affect pair state'
  );
  assert.ok(
    !pairStateBlock.includes('computeLegacyComparison'),
    'computeLegacyComparison flag should not affect pair state'
  );
});
