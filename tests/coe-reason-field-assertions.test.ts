/**
 * T2: CoE reason field assertions
 *
 * Verifies that the CoE integrator produces meaningful contribution/reason
 * data for traceability.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { integrateCoEAppraisal } from '@/lib/rules/coe-integrator';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import type {
  CoEIntegratorConfig,
  EmotionSpec,
  RelationalAppraisal,
  RelationshipMetrics,
} from '@/lib/schemas';
import { DEFAULT_COE_INTEGRATOR_CONFIG } from '@/lib/schemas';

const DEFAULT_EMOTION_SPEC: EmotionSpec = {
  baselinePAD: { pleasure: 0.1, arousal: 0, dominance: 0.05 },
  recovery: {
    pleasureHalfLifeTurns: 5,
    arousalHalfLifeTurns: 3,
    dominanceHalfLifeTurns: 4,
  },
  appraisalSensitivity: {
    goalCongruence: 0.6,
    controllability: 0.5,
    certainty: 0.5,
    normAlignment: 0.6,
    attachmentSecurity: 0.7,
    reciprocity: 0.7,
    pressureIntrusiveness: 0.7,
    novelty: 0.5,
    selfRelevance: 0.5,
  },
  externalization: {
    warmthWeight: 0.7,
    tersenessWeight: 0.3,
    directnessWeight: 0.4,
    teasingWeight: 0.2,
  },
  coeIntegrator: DEFAULT_COE_INTEGRATOR_CONFIG as CoEIntegratorConfig,
};

const ENTRY_PHASE = { mode: 'entry' as const, adultIntimacyEligibility: 'never' as const };

function buildMetrics(overrides: Partial<RelationshipMetrics> = {}): RelationshipMetrics {
  return { trust: 50, affinity: 50, conflict: 0, intimacyReadiness: 10, ...overrides };
}

function buildAppraisal(overrides: Partial<RelationalAppraisal> = {}): RelationalAppraisal {
  return {
    warmthImpact: 0, rejectionImpact: 0, respectImpact: 0, threatImpact: 0,
    pressureImpact: 0, repairImpact: 0, reciprocityImpact: 0,
    intimacySignal: 0, boundarySignal: 0, certainty: 0.5,
    ...overrides,
  };
}

test('CoE integrator contributions are non-empty for active turns', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0, arousal: 0, dominance: 0 }),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal({ warmthImpact: 0.7, respectImpact: 0.5, certainty: 0.8 }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  });

  assert.ok(result.contributions.length > 0, 'Active turn must produce contributions');
});

test('CoE integrator contributions have non-empty reason strings', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0, arousal: 0, dominance: 0 }),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal({ warmthImpact: 0.6, certainty: 0.7 }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  });

  for (const contribution of result.contributions) {
    assert.ok(contribution.reason.length > 0, `Contribution must have a reason: ${JSON.stringify(contribution)}`);
    assert.ok(
      ['appraisal', 'decay', 'open_thread_bias', 'blend', 'clamp'].includes(contribution.source),
      `Contribution source must be valid: ${contribution.source}`
    );
    assert.ok(
      ['pleasure', 'arousal', 'dominance'].includes(contribution.axis),
      `Contribution axis must be valid: ${contribution.axis}`
    );
  }
});

test('CoE integrator: compliment produces positive pleasure contribution from appraisal', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0, arousal: 0, dominance: 0 }),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal({ warmthImpact: 0.7, respectImpact: 0.5, certainty: 0.85 }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  });

  const pleasureAppraisal = result.contributions.find(
    (c) => c.axis === 'pleasure' && c.source === 'appraisal'
  );
  assert.ok(pleasureAppraisal, 'Compliment must produce pleasure appraisal contribution');
  assert.ok(pleasureAppraisal.delta > 0, 'Compliment pleasure delta must be positive');
});

test('CoE integrator: insult produces negative pleasure contribution from appraisal', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.2, arousal: 0.1, dominance: 0.1 }),
    currentMetrics: buildMetrics({ trust: 60, affinity: 55 }),
    appraisal: buildAppraisal({
      warmthImpact: -0.8,
      rejectionImpact: 0.7,
      respectImpact: -0.6,
      threatImpact: 0.5,
      certainty: 0.9,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  });

  const pleasureAppraisal = result.contributions.find(
    (c) => c.axis === 'pleasure' && c.source === 'appraisal'
  );
  assert.ok(pleasureAppraisal, 'Insult must produce pleasure appraisal contribution');
  assert.ok(pleasureAppraisal.delta < 0, 'Insult pleasure delta must be negative');
});

test('CoE integrator: quiet turn still tracks decay contributions', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.5, arousal: 0.3, dominance: 0.2 }),
    currentMetrics: buildMetrics({ trust: 80, affinity: 85 }),
    appraisal: buildAppraisal({ warmthImpact: 0.02, certainty: 0.3 }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 5,
  });

  assert.ok(result.quietTurn, 'Low appraisal strength should produce quiet turn');
  const decayContributions = result.contributions.filter((c) => c.source === 'decay');
  assert.ok(decayContributions.length > 0, 'Quiet turn should still have decay contributions');
  for (const c of decayContributions) {
    assert.ok(c.reason.length > 0, 'Decay contribution must have reason');
  }
});
