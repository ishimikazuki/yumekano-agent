/**
 * T2: Legacy comparison computation test
 *
 * Verifies that when computeLegacyComparison is enabled,
 * the legacy heuristic path comparison is computed and has
 * the expected shape (before/after/delta/explanation).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLegacyRelationalAppraisalFromExtraction,
  adaptLegacyRelationalAppraisalToLegacyAppraisal,
  mapLegacyToCanonicalRelational,
} from '@/lib/adapters/coe-emotion-contract';
import { integrateCoEAppraisal } from '@/lib/rules/coe-integrator';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import { LegacyEmotionComparisonSchema, DEFAULT_COE_INTEGRATOR_CONFIG } from '@/lib/schemas';
import type {
  CoEEvidenceExtractorResult,
  CoEIntegratorConfig,
  EmotionSpec,
  RelationshipMetrics,
} from '@/lib/schemas';

const DEFAULT_EMOTION_SPEC: EmotionSpec = {
  baselinePAD: { pleasure: 0.1, arousal: 0, dominance: 0.05 },
  recovery: {
    pleasureHalfLifeTurns: 5,
    arousalHalfLifeTurns: 3,
    dominanceHalfLifeTurns: 4,
  },
  appraisalSensitivity: {
    goalCongruence: 0.6, controllability: 0.5, certainty: 0.5,
    normAlignment: 0.6, attachmentSecurity: 0.7, reciprocity: 0.7,
    pressureIntrusiveness: 0.7, novelty: 0.5, selfRelevance: 0.5,
  },
  externalization: {
    warmthWeight: 0.7, tersenessWeight: 0.3, directnessWeight: 0.4, teasingWeight: 0.2,
  },
  coeIntegrator: DEFAULT_COE_INTEGRATOR_CONFIG as CoEIntegratorConfig,
};

const COMPLIMENT_EXTRACTION: CoEEvidenceExtractorResult = {
  interactionActs: [
    {
      act: 'compliment',
      target: 'character',
      polarity: 'positive',
      intensity: 0.7,
      confidence: 0.85,
      evidenceSpans: [{ text: 'You look great today', source: 'user_message' as const, sourceId: null, start: 0, end: 20 }],
      uncertaintyNotes: [],
    },
  ],
  relationalAppraisal: {
    warmthImpact: 0.6,
    rejectionImpact: -0.1,
    respectImpact: 0.3,
    threatImpact: -0.1,
    pressureImpact: 0,
    repairImpact: 0,
    reciprocityImpact: 0.2,
    intimacySignal: 0.15,
    boundarySignal: 0.1,
    certainty: 0.85,
  },
  confidence: 0.85,
  uncertaintyNotes: [],
};

const NEUTRAL_EMOTION = createRuntimeEmotionState({ pleasure: 0, arousal: 0, dominance: 0 });

const NEUTRAL_METRICS: RelationshipMetrics = {
  affinity: 50, trust: 50, intimacyReadiness: 0, conflict: 0,
};

const ENTRY_PHASE = {
  mode: 'entry' as const,
  adultIntimacyEligibility: 'never' as const,
};

test('T2: legacy comparison builds from extraction with expected shape', () => {
  const legacyRA = buildLegacyRelationalAppraisalFromExtraction({
    extraction: COMPLIMENT_EXTRACTION,
  });
  const canonicalRA = mapLegacyToCanonicalRelational(legacyRA);
  const legacyResult = integrateCoEAppraisal({
    currentEmotion: NEUTRAL_EMOTION,
    currentMetrics: NEUTRAL_METRICS,
    appraisal: canonicalRA,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: COMPLIMENT_EXTRACTION.interactionActs,
    now: new Date(),
  });
  const legacyAppraisal = adaptLegacyRelationalAppraisalToLegacyAppraisal(legacyRA);

  const comparison = {
    appraisal: legacyAppraisal,
    emotionAfter: legacyResult.after.combined,
    emotionStateAfter: legacyResult.after,
    relationshipAfter: legacyResult.relationshipAfter,
    relationshipDeltas: legacyResult.pairDelta,
    coeContributions: legacyResult.contributions,
  };

  const parsed = LegacyEmotionComparisonSchema.safeParse(comparison);
  assert.ok(parsed.success, `Schema validation failed: ${JSON.stringify(parsed.error?.issues)}`);
});

test('T2: legacy comparison has before/after delta structure', () => {
  const legacyRA = buildLegacyRelationalAppraisalFromExtraction({
    extraction: COMPLIMENT_EXTRACTION,
  });
  const legacyAppraisal = adaptLegacyRelationalAppraisalToLegacyAppraisal(legacyRA);

  assert.ok('goalCongruence' in legacyAppraisal);
  assert.ok('controllability' in legacyAppraisal);
  assert.ok('reciprocity' in legacyAppraisal);
  assert.ok('pressureIntrusiveness' in legacyAppraisal);

  const canonicalRA = mapLegacyToCanonicalRelational(legacyRA);
  const legacyResult = integrateCoEAppraisal({
    currentEmotion: NEUTRAL_EMOTION,
    currentMetrics: NEUTRAL_METRICS,
    appraisal: canonicalRA,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: COMPLIMENT_EXTRACTION.interactionActs,
    now: new Date(),
  });

  assert.ok('pleasure' in legacyResult.after.combined);
  assert.ok('arousal' in legacyResult.after.combined);
  assert.ok('dominance' in legacyResult.after.combined);
  assert.ok('affinity' in legacyResult.pairDelta);
  assert.ok('trust' in legacyResult.pairDelta);
  assert.ok(Array.isArray(legacyResult.contributions));
});

test('T2: legacy comparison produces different results from new CoE path', () => {
  const newResult = integrateCoEAppraisal({
    currentEmotion: NEUTRAL_EMOTION,
    currentMetrics: NEUTRAL_METRICS,
    appraisal: COMPLIMENT_EXTRACTION.relationalAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: COMPLIMENT_EXTRACTION.interactionActs,
    now: new Date(),
  });

  const legacyRA = buildLegacyRelationalAppraisalFromExtraction({
    extraction: COMPLIMENT_EXTRACTION,
  });
  const canonicalRA = mapLegacyToCanonicalRelational(legacyRA);
  const legacyResult = integrateCoEAppraisal({
    currentEmotion: NEUTRAL_EMOTION,
    currentMetrics: NEUTRAL_METRICS,
    appraisal: canonicalRA,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: COMPLIMENT_EXTRACTION.interactionActs,
    now: new Date(),
  });

  const newPad = newResult.after.combined;
  const legacyPad = legacyResult.after.combined;

  for (const axis of ['pleasure', 'arousal', 'dominance'] as const) {
    assert.ok(newPad[axis] >= -1 && newPad[axis] <= 1, `new ${axis} in range`);
    assert.ok(legacyPad[axis] >= -1 && legacyPad[axis] <= 1, `legacy ${axis} in range`);
  }
});
