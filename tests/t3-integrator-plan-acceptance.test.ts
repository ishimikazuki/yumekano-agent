import assert from 'node:assert/strict';
import test from 'node:test';
import { integrateCoEAppraisal } from '@/lib/rules/coe-integrator';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import type {
  EmotionSpec,
  ExtractedInteractionAct,
  OpenThread,
  RelationalAppraisal,
  RelationshipMetrics,
  RuntimeEmotionState,
} from '@/lib/schemas';
import { DEFAULT_COE_INTEGRATOR_CONFIG } from '@/lib/schemas';

const DEFAULT_EMOTION_SPEC: EmotionSpec = {
  baselinePAD: {
    pleasure: 0.1,
    arousal: 0,
    dominance: 0.05,
  },
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
  coeIntegrator: DEFAULT_COE_INTEGRATOR_CONFIG,
};

const RELATIONSHIP_PHASE = {
  mode: 'relationship' as const,
  adultIntimacyEligibility: 'conditional' as const,
};

type IntegratorInput = Parameters<typeof integrateCoEAppraisal>[0];
type IntegratorAppraisal = IntegratorInput['appraisal'];

function buildAppraisal(overrides: Partial<RelationalAppraisal>): RelationalAppraisal {
  return {
    warmthImpact: 0,
    rejectionImpact: 0,
    respectImpact: 0,
    threatImpact: 0,
    pressureImpact: 0,
    repairImpact: 0,
    reciprocityImpact: 0,
    intimacySignal: 0,
    boundarySignal: 0,
    certainty: 0.8,
    ...overrides,
  };
}

function buildMetrics(overrides: Partial<RelationshipMetrics> = {}): RelationshipMetrics {
  return {
    trust: 50,
    affinity: 50,
    conflict: 0,
    intimacyReadiness: 10,
    ...overrides,
  };
}

function buildEmotion(overrides?: Partial<RuntimeEmotionState>): RuntimeEmotionState {
  const base = createRuntimeEmotionState(
    {
      pleasure: 0.1,
      arousal: 0,
      dominance: 0.05,
    },
    new Date('2026-03-25T00:00:00.000Z')
  );

  return {
    ...base,
    ...overrides,
  };
}

function buildAct(overrides: Partial<ExtractedInteractionAct>): ExtractedInteractionAct {
  return {
    act: 'other',
    target: 'unknown',
    polarity: 'neutral',
    intensity: 0.5,
    evidenceSpans: [
      {
        source: 'user_message',
        sourceId: null,
        text: 'stub',
        start: 0,
        end: 4,
      },
    ],
    confidence: 0.9,
    uncertaintyNotes: [],
    ...overrides,
  };
}

function buildOpenThread(overrides: Partial<OpenThread> = {}): OpenThread {
  return {
    id: '00000000-0000-0000-0000-000000000111',
    pairId: '00000000-0000-0000-0000-000000000222',
    key: 'pending_tension',
    summary: 'Unresolved tension',
    severity: 0.6,
    status: 'open',
    openedByEventId: null,
    resolvedByEventId: null,
    updatedAt: new Date('2026-03-25T00:00:00.000Z'),
    ...overrides,
  };
}

function padDelta(before: RuntimeEmotionState, after: RuntimeEmotionState) {
  return {
    pleasure: after.combined.pleasure - before.combined.pleasure,
    arousal: after.combined.arousal - before.combined.arousal,
    dominance: after.combined.dominance - before.combined.dominance,
  };
}

test('Task T3 explicit insult meets the plan delta band', () => {
  const currentEmotion = buildEmotion();
  const currentMetrics = buildMetrics({ trust: 56, affinity: 58, conflict: 6, intimacyReadiness: 12 });
  const result = integrateCoEAppraisal({
    currentEmotion,
    currentMetrics,
    appraisal: buildAppraisal({
      warmthImpact: -0.85,
      rejectionImpact: 0.72,
      respectImpact: -0.9,
      threatImpact: 0.62,
      pressureImpact: 0.48,
      repairImpact: -0.4,
      reciprocityImpact: -0.5,
      intimacySignal: -0.2,
      boundarySignal: -0.55,
      certainty: 0.92,
    }) as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'insult', target: 'character', polarity: 'negative', intensity: 0.95 })],
  });
  const delta = padDelta(currentEmotion, result.after);

  assert.ok(delta.pleasure <= -0.2);
  assert.ok(delta.arousal >= 0.15);
  assert.ok(delta.dominance <= -0.15);
  assert.ok(result.relationshipAfter.trust - currentMetrics.trust <= -10);
  assert.ok(result.relationshipAfter.affinity - currentMetrics.affinity <= -8);
  assert.ok(result.relationshipAfter.conflict - currentMetrics.conflict >= 12);
  assert.ok(result.relationshipAfter.intimacyReadiness - currentMetrics.intimacyReadiness <= 0);
});

test('Task T3 apology after hurt meets the plan delta band and lowers conflict', () => {
  const currentEmotion = buildEmotion({
    fastAffect: { pleasure: -0.22, arousal: 0.26, dominance: -0.16 },
    slowMood: { pleasure: -0.12, arousal: 0.14, dominance: -0.09 },
    combined: { pleasure: -0.18, arousal: 0.21, dominance: -0.13 },
  });
  const currentMetrics = buildMetrics({ trust: 42, affinity: 45, conflict: 26, intimacyReadiness: 9 });
  const result = integrateCoEAppraisal({
    currentEmotion,
    currentMetrics,
    appraisal: buildAppraisal({
      warmthImpact: 0.24,
      rejectionImpact: -0.15,
      respectImpact: 0.3,
      threatImpact: -0.22,
      pressureImpact: -0.1,
      repairImpact: 0.88,
      reciprocityImpact: 0.36,
      intimacySignal: 0.12,
      boundarySignal: 0.18,
      certainty: 0.9,
    }) as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [
      buildAct({ act: 'apology', target: 'relationship', polarity: 'positive', intensity: 0.84 }),
      buildAct({ act: 'repair', target: 'relationship', polarity: 'positive', intensity: 0.78 }),
    ],
  });
  const delta = padDelta(currentEmotion, result.after);

  assert.ok(delta.pleasure >= 0.1);
  assert.ok(delta.arousal <= -0.05);
  assert.ok(delta.dominance >= 0.05);
  assert.ok(result.relationshipAfter.trust - currentMetrics.trust >= 8);
  assert.ok(result.relationshipAfter.affinity - currentMetrics.affinity >= 4);
  assert.ok(result.relationshipAfter.conflict - currentMetrics.conflict <= -5);
  assert.ok(result.relationshipAfter.intimacyReadiness - currentMetrics.intimacyReadiness >= 0);
});

test('Task T3 quiet turn smoothly returns emotion and metrics toward baseline', () => {
  const currentEmotion = buildEmotion({
    fastAffect: { pleasure: 0.55, arousal: 0.18, dominance: 0.22 },
    slowMood: { pleasure: 0.48, arousal: 0.12, dominance: 0.2 },
    combined: { pleasure: 0.52, arousal: 0.16, dominance: 0.21 },
  });
  const currentMetrics = buildMetrics({ trust: 82, affinity: 88, conflict: 22, intimacyReadiness: 52 });
  const result = integrateCoEAppraisal({
    currentEmotion,
    currentMetrics,
    appraisal: buildAppraisal({
      warmthImpact: 0.02,
      rejectionImpact: 0,
      respectImpact: 0.02,
      threatImpact: 0,
      pressureImpact: 0,
      repairImpact: 0.01,
      reciprocityImpact: 0.02,
      intimacySignal: 0.02,
      boundarySignal: 0.02,
      certainty: 0.55,
    }) as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 4,
  });

  assert.equal(result.quietTurn, true);
  assert.ok(Math.abs(result.after.combined.pleasure - DEFAULT_EMOTION_SPEC.baselinePAD.pleasure) < Math.abs(currentEmotion.combined.pleasure - DEFAULT_EMOTION_SPEC.baselinePAD.pleasure));
  assert.ok(Math.abs(result.after.combined.arousal - DEFAULT_EMOTION_SPEC.baselinePAD.arousal) < Math.abs(currentEmotion.combined.arousal - DEFAULT_EMOTION_SPEC.baselinePAD.arousal));
  assert.ok(Math.abs(result.after.combined.dominance - DEFAULT_EMOTION_SPEC.baselinePAD.dominance) < Math.abs(currentEmotion.combined.dominance - DEFAULT_EMOTION_SPEC.baselinePAD.dominance));
  assert.ok(result.relationshipAfter.trust < currentMetrics.trust);
  assert.ok(result.relationshipAfter.affinity < currentMetrics.affinity);
  assert.ok(result.relationshipAfter.conflict < currentMetrics.conflict);
  assert.ok(result.relationshipAfter.intimacyReadiness < currentMetrics.intimacyReadiness);
});

test('Task T3 sustained pressure accumulates across multiple turns', () => {
  const appraisal = buildAppraisal({
    warmthImpact: -0.35,
    rejectionImpact: 0.18,
    respectImpact: -0.52,
    threatImpact: 0.38,
    pressureImpact: 0.88,
    repairImpact: -0.18,
    reciprocityImpact: -0.22,
    intimacySignal: 0.08,
    boundarySignal: -0.42,
    certainty: 0.91,
  });
  const currentMetrics = buildMetrics({ trust: 45, affinity: 48, conflict: 18, intimacyReadiness: 14 });

  const first = integrateCoEAppraisal({
    currentEmotion: buildEmotion({
      slowMood: { pleasure: -0.05, arousal: 0.2, dominance: -0.04 },
      combined: { pleasure: 0.01, arousal: 0.12, dominance: 0.01 },
    }),
    currentMetrics,
    appraisal: appraisal as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [buildOpenThread({ severity: 0.8 })],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'pressure', target: 'boundary', polarity: 'negative', intensity: 0.87 })],
  });
  const second = integrateCoEAppraisal({
    currentEmotion: first.after,
    currentMetrics: first.relationshipAfter,
    appraisal: appraisal as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [buildOpenThread({ severity: 0.8 })],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'pressure', target: 'boundary', polarity: 'negative', intensity: 0.87 })],
  });

  assert.ok(second.after.combined.pleasure < first.after.combined.pleasure);
  assert.ok(second.after.combined.arousal >= first.after.combined.arousal);
  assert.ok(second.after.combined.dominance < first.after.combined.dominance);
  assert.ok(second.relationshipAfter.trust < first.relationshipAfter.trust);
  assert.ok(second.relationshipAfter.affinity < first.relationshipAfter.affinity);
  assert.ok(second.relationshipAfter.conflict > first.relationshipAfter.conflict);
  assert.ok(second.relationshipAfter.intimacyReadiness < first.relationshipAfter.intimacyReadiness);
});

test('Task T3 open threads bias the same appraisal toward lower pleasure and higher conflict', () => {
  const appraisal = buildAppraisal({
    warmthImpact: 0.42,
    rejectionImpact: -0.1,
    respectImpact: 0.26,
    threatImpact: -0.08,
    pressureImpact: 0.02,
    repairImpact: 0.2,
    reciprocityImpact: 0.31,
    intimacySignal: 0.24,
    boundarySignal: 0.22,
    certainty: 0.82,
  });

  const clear = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 60, affinity: 62, conflict: 5, intimacyReadiness: 18 }),
    appraisal: appraisal as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  });
  const threaded = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 60, affinity: 62, conflict: 5, intimacyReadiness: 18 }),
    appraisal: appraisal as unknown as IntegratorAppraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [
      buildOpenThread({ id: '00000000-0000-0000-0000-000000000333', severity: 0.9 }),
      buildOpenThread({ id: '00000000-0000-0000-0000-000000000444', severity: 0.7 }),
    ],
    turnsSinceLastUpdate: 1,
  });

  assert.ok(threaded.after.combined.pleasure < clear.after.combined.pleasure);
  assert.ok(threaded.relationshipAfter.conflict > clear.relationshipAfter.conflict);
});
