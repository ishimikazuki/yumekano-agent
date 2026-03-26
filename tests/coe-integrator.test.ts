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

const ENTRY_PHASE = {
  mode: 'entry' as const,
  adultIntimacyEligibility: 'never' as const,
};

function buildAppraisal(overrides: Partial<RelationalAppraisal>): RelationalAppraisal {
  return {
    source: 'model',
    summary: 'test relational appraisal',
    warmthSignal: 0,
    reciprocitySignal: 0,
    safetySignal: 0,
    boundaryRespect: 0,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0,
    confidence: 0.8,
    evidence: [],
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

test('insult shock guardrail sharply drops pleasure and trust', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 56, affinity: 58, conflict: 6 }),
    appraisal: buildAppraisal({
      summary: 'explicit insult toward the character',
      warmthSignal: -0.9,
      reciprocitySignal: -0.5,
      safetySignal: -0.8,
      boundaryRespect: -0.6,
      pressureSignal: 0.55,
      repairSignal: -0.8,
      intimacySignal: -0.3,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'insult', target: 'character', polarity: 'negative' })],
  });

  assert.deepEqual(result.appliedGuardrails, ['insultShock']);
  assert.ok(result.after.combined.pleasure < -0.15);
  assert.ok(result.after.combined.arousal > 0.1);
  assert.ok(result.after.combined.dominance < -0.15);
  assert.ok(result.relationshipAfter.trust < 48);
  assert.ok(result.relationshipAfter.affinity < 52);
  assert.ok(result.relationshipAfter.conflict > 12);
});

test('apology repair guardrail rebuilds trust and cools conflict', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion({
      fastAffect: { pleasure: -0.2, arousal: 0.25, dominance: -0.15 },
      slowMood: { pleasure: -0.1, arousal: 0.12, dominance: -0.08 },
      combined: { pleasure: -0.16, arousal: 0.2, dominance: -0.12 },
    }),
    currentMetrics: buildMetrics({ trust: 42, affinity: 45, conflict: 26, intimacyReadiness: 9 }),
    appraisal: buildAppraisal({
      summary: 'user apologizes and attempts repair',
      warmthSignal: 0.34,
      reciprocitySignal: 0.28,
      safetySignal: 0.22,
      boundaryRespect: 0.35,
      pressureSignal: 0.06,
      repairSignal: 0.82,
      intimacySignal: 0.12,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [
      buildAct({ act: 'apology', target: 'relationship', polarity: 'positive', intensity: 0.8 }),
      buildAct({ act: 'repair', target: 'relationship', polarity: 'positive', intensity: 0.7 }),
    ],
  });

  assert.ok(result.appliedGuardrails.includes('apologyRepair'));
  assert.ok(result.after.combined.pleasure > -0.02);
  assert.ok(result.after.combined.arousal < 0.15);
  assert.ok(result.relationshipAfter.trust > 46);
  assert.ok(result.relationshipAfter.affinity > 47);
  assert.ok(result.relationshipAfter.conflict < 22);
});

test('sustained pressure stacks a deterministic override on top of pressure appraisal', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion({
      slowMood: { pleasure: -0.05, arousal: 0.2, dominance: -0.04 },
      combined: { pleasure: 0.01, arousal: 0.12, dominance: 0.01 },
    }),
    currentMetrics: buildMetrics({ trust: 45, affinity: 48, conflict: 18, intimacyReadiness: 14 }),
    appraisal: buildAppraisal({
      summary: 'user keeps pressing after resistance',
      warmthSignal: -0.42,
      reciprocitySignal: -0.2,
      safetySignal: -0.3,
      boundaryRespect: -0.28,
      pressureSignal: 0.78,
      repairSignal: -0.2,
      intimacySignal: 0.08,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [buildOpenThread({ severity: 0.8 })],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'pressure', target: 'boundary', polarity: 'negative', intensity: 0.85 })],
  });

  assert.ok(result.appliedGuardrails.includes('sustainedPressure'));
  assert.ok(result.relationshipAfter.trust < 40);
  assert.ok(result.relationshipAfter.conflict > 24);
  assert.ok(result.relationshipAfter.intimacyReadiness < 11);
  assert.ok(result.after.combined.dominance < -0.1);
});

test('affectionate carry-over keeps positive slow mood active on a warm follow-up turn', () => {
  const carried = integrateCoEAppraisal({
    currentEmotion: buildEmotion({
      fastAffect: { pleasure: 0.46, arousal: 0.2, dominance: 0.18 },
      slowMood: { pleasure: 0.42, arousal: 0.08, dominance: 0.16 },
      combined: { pleasure: 0.44, arousal: 0.15, dominance: 0.17 },
    }),
    currentMetrics: buildMetrics({ trust: 72, affinity: 78, conflict: 4, intimacyReadiness: 34 }),
    appraisal: buildAppraisal({
      summary: 'gentle affectionate follow-up',
      warmthSignal: 0.34,
      reciprocitySignal: 0.28,
      safetySignal: 0.36,
      boundaryRespect: 0.32,
      pressureSignal: 0.02,
      repairSignal: 0.1,
      intimacySignal: 0.38,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'affection', target: 'relationship', polarity: 'positive', intensity: 0.7 })],
  });
  const neutral = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 72, affinity: 78, conflict: 4, intimacyReadiness: 34 }),
    appraisal: buildAppraisal({
      summary: 'gentle affectionate follow-up',
      warmthSignal: 0.34,
      reciprocitySignal: 0.28,
      safetySignal: 0.36,
      boundaryRespect: 0.32,
      pressureSignal: 0.02,
      repairSignal: 0.1,
      intimacySignal: 0.38,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'affection', target: 'relationship', polarity: 'positive', intensity: 0.7 })],
  });

  assert.ok(carried.after.combined.pleasure > neutral.after.combined.pleasure);
  assert.ok(carried.after.slowMood.pleasure > neutral.after.slowMood.pleasure);
  assert.ok(carried.relationshipAfter.intimacyReadiness > 34);
});

test('quiet turns decay emotion and relationship metrics toward their baselines', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion({
      fastAffect: { pleasure: 0.55, arousal: 0.18, dominance: 0.22 },
      slowMood: { pleasure: 0.48, arousal: 0.12, dominance: 0.2 },
      combined: { pleasure: 0.52, arousal: 0.16, dominance: 0.21 },
    }),
    currentMetrics: buildMetrics({ trust: 82, affinity: 88, conflict: 22, intimacyReadiness: 52 }),
    appraisal: buildAppraisal({
      summary: 'quiet housekeeping turn',
      warmthSignal: 0.03,
      reciprocitySignal: 0.02,
      safetySignal: 0.05,
      boundaryRespect: 0.04,
      pressureSignal: 0,
      repairSignal: 0.02,
      intimacySignal: 0.04,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 4,
  });

  assert.equal(result.quietTurn, true);
  assert.ok(result.after.combined.pleasure < 0.41);
  assert.ok(result.relationshipAfter.trust < 80);
  assert.ok(result.relationshipAfter.affinity < 86);
  assert.ok(result.relationshipAfter.conflict < 20);
  assert.ok(result.relationshipAfter.intimacyReadiness < 48);
});

test('open threads bias the same appraisal toward lower pleasure and higher conflict', () => {
  const appraisal = buildAppraisal({
    summary: 'warm but unresolved follow-up',
    warmthSignal: 0.42,
    reciprocitySignal: 0.3,
    safetySignal: 0.34,
    boundaryRespect: 0.28,
    pressureSignal: 0.02,
    repairSignal: 0.2,
    intimacySignal: 0.22,
  });

  const clear = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 60, affinity: 62, conflict: 5, intimacyReadiness: 18 }),
    appraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  });
  const threaded = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 60, affinity: 62, conflict: 5, intimacyReadiness: 18 }),
    appraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [
      buildOpenThread({ id: '00000000-0000-0000-0000-000000000333', severity: 0.9 }),
      buildOpenThread({ id: '00000000-0000-0000-0000-000000000444', severity: 0.7 }),
    ],
    turnsSinceLastUpdate: 1,
  });

  assert.ok(threaded.after.combined.pleasure < clear.after.combined.pleasure);
  assert.ok(threaded.after.combined.dominance < clear.after.combined.dominance);
  assert.ok(threaded.relationshipAfter.trust < clear.relationshipAfter.trust);
  assert.ok(threaded.relationshipAfter.affinity < clear.relationshipAfter.affinity);
  assert.ok(threaded.relationshipAfter.conflict > clear.relationshipAfter.conflict);
});

test('consent boundary guardrail suppresses intimacy escalation in entry phase', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 40, affinity: 44, conflict: 6, intimacyReadiness: 8 }),
    appraisal: buildAppraisal({
      summary: 'intimacy escalation across a phase boundary',
      warmthSignal: 0.1,
      reciprocitySignal: 0.08,
      safetySignal: -0.05,
      boundaryRespect: -0.52,
      pressureSignal: 0.44,
      repairSignal: 0,
      intimacySignal: 0.82,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [buildAct({ act: 'intimacy_bid', target: 'boundary', polarity: 'mixed', intensity: 0.92 })],
  });

  assert.ok(result.appliedGuardrails.includes('consentBoundary'));
  assert.ok(result.relationshipAfter.intimacyReadiness <= 8);
  assert.ok(result.relationshipAfter.conflict > 8);
  assert.ok(result.after.combined.pleasure < 0.05);
});
