import assert from 'node:assert/strict';
import test from 'node:test';
import { integrateCoEAppraisal } from '@/lib/rules/coe-integrator';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import type {
  CoEIntegratorConfig,
  EmotionSpec,
  ExtractedInteractionAct,
  OpenThread,
  RelationalAppraisal,
  RelationshipMetrics,
  RuntimeEmotionState,
} from '@/lib/schemas';
import { DEFAULT_COE_INTEGRATOR_CONFIG } from '@/lib/schemas';

type NumericBand = { min: number; max: number };

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
  coeIntegrator: DEFAULT_COE_INTEGRATOR_CONFIG as CoEIntegratorConfig,
};

const RELATIONSHIP_PHASE = {
  mode: 'relationship' as const,
  adultIntimacyEligibility: 'conditional' as const,
};

const ENTRY_PHASE = {
  mode: 'entry' as const,
  adultIntimacyEligibility: 'never' as const,
};

function inBand(value: number, band: NumericBand): boolean {
  return value >= band.min && value <= band.max;
}

function assertBand(value: number, band: NumericBand, label: string): void {
  assert.equal(
    inBand(value, band),
    true,
    `${label} expected [${band.min}, ${band.max}], got ${value}`
  );
}

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

const fixtureCases = [
  {
    id: 'insult shock',
    input: {
      currentEmotion: buildEmotion(),
      currentMetrics: buildMetrics({ trust: 56, affinity: 58, conflict: 6, intimacyReadiness: 12 }),
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
      }),
      currentPhase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
      turnsSinceLastUpdate: 1,
      interactionActs: [
        buildAct({ act: 'insult', target: 'character', polarity: 'negative', intensity: 0.95 }),
      ],
    },
    expected: {
      guardrail: 'insultShock',
      pad: {
        pleasure: { min: -0.9, max: -0.6 },
        arousal: { min: 0.24, max: 0.45 },
        dominance: { min: -0.78, max: -0.55 },
      },
      pair: {
        trust: { min: -20, max: -12 },
        affinity: { min: -15, max: -10 },
        conflict: { min: 14, max: 22 },
        intimacyReadiness: { min: -8, max: -4 },
      },
    },
  },
  {
    id: 'apology repair',
    input: {
      currentEmotion: buildEmotion({
        fastAffect: { pleasure: -0.22, arousal: 0.26, dominance: -0.16 },
        slowMood: { pleasure: -0.12, arousal: 0.14, dominance: -0.09 },
        combined: { pleasure: -0.18, arousal: 0.21, dominance: -0.13 },
      }),
      currentMetrics: buildMetrics({ trust: 42, affinity: 45, conflict: 26, intimacyReadiness: 9 }),
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
      }),
      currentPhase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
      turnsSinceLastUpdate: 1,
      interactionActs: [
        buildAct({ act: 'apology', target: 'relationship', polarity: 'positive', intensity: 0.84 }),
        buildAct({ act: 'repair', target: 'relationship', polarity: 'positive', intensity: 0.78 }),
      ],
    },
    expected: {
      guardrail: 'apologyRepair',
      pad: {
        pleasure: { min: 0.24, max: 0.4 },
        arousal: { min: -0.24, max: -0.1 },
        dominance: { min: 0.2, max: 0.4 },
      },
      pair: {
        trust: { min: 6, max: 11 },
        affinity: { min: 4, max: 8 },
        conflict: { min: -7, max: -3 },
        intimacyReadiness: { min: 3.5, max: 6 },
      },
    },
  },
  {
    id: 'sustained pressure',
    input: {
      currentEmotion: buildEmotion({
        slowMood: { pleasure: -0.05, arousal: 0.2, dominance: -0.04 },
        combined: { pleasure: 0.01, arousal: 0.12, dominance: 0.01 },
      }),
      currentMetrics: buildMetrics({ trust: 45, affinity: 48, conflict: 18, intimacyReadiness: 14 }),
      appraisal: buildAppraisal({
        warmthImpact: -0.42,
        rejectionImpact: 0.22,
        respectImpact: -0.28,
        threatImpact: 0.42,
        pressureImpact: 0.78,
        repairImpact: -0.2,
        reciprocityImpact: -0.2,
        intimacySignal: 0.08,
        boundarySignal: -0.32,
        certainty: 0.86,
      }),
      currentPhase: RELATIONSHIP_PHASE,
      openThreads: [buildOpenThread({ severity: 0.8 })],
      turnsSinceLastUpdate: 1,
      interactionActs: [
        buildAct({ act: 'pressure', target: 'boundary', polarity: 'negative', intensity: 0.87 }),
      ],
    },
    expected: {
      guardrail: 'sustainedPressure',
      pad: {
        pleasure: { min: -0.75, max: -0.5 },
        arousal: { min: 0.24, max: 0.4 },
        dominance: { min: -0.72, max: -0.48 },
      },
      pair: {
        trust: { min: -17, max: -11 },
        affinity: { min: -12, max: -8 },
        conflict: { min: 14, max: 21 },
        intimacyReadiness: { min: -7.5, max: -4 },
      },
    },
  },
  {
    id: 'quiet-turn decay',
    input: {
      currentEmotion: buildEmotion({
        fastAffect: { pleasure: 0.55, arousal: 0.18, dominance: 0.22 },
        slowMood: { pleasure: 0.48, arousal: 0.12, dominance: 0.2 },
        combined: { pleasure: 0.52, arousal: 0.16, dominance: 0.21 },
      }),
      currentMetrics: buildMetrics({ trust: 82, affinity: 88, conflict: 22, intimacyReadiness: 52 }),
      appraisal: buildAppraisal({
        warmthImpact: 0.03,
        rejectionImpact: -0.01,
        respectImpact: 0.05,
        threatImpact: 0,
        pressureImpact: 0,
        repairImpact: 0.02,
        reciprocityImpact: 0.02,
        intimacySignal: 0.04,
        boundarySignal: 0.04,
        certainty: 0.62,
      }),
      currentPhase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
      turnsSinceLastUpdate: 4,
      interactionActs: [] as ExtractedInteractionAct[],
    },
    expected: {
      quietTurn: true,
      pad: {
        pleasure: { min: -0.25, max: -0.05 },
        arousal: { min: -0.2, max: -0.03 },
        dominance: { min: -0.15, max: -0.02 },
      },
      pair: {
        trust: { min: -9, max: -1.5 },
        affinity: { min: -8, max: -1.5 },
        conflict: { min: -10, max: -6 },
        intimacyReadiness: { min: -17, max: -10 },
      },
    },
  },
] as const;

for (const fixture of fixtureCases) {
  test(`fixture: ${fixture.id}`, () => {
    const result = integrateCoEAppraisal({
      ...fixture.input,
      emotionSpec: DEFAULT_EMOTION_SPEC,
    });

    if (fixture.expected.guardrail) {
      assert.ok(result.appliedGuardrails.includes(fixture.expected.guardrail));
    }
    if (fixture.expected.quietTurn !== undefined) {
      assert.equal(result.quietTurn, fixture.expected.quietTurn);
    }

    assertBand(result.padDelta.pleasure, fixture.expected.pad.pleasure, `${fixture.id} padDelta.pleasure`);
    assertBand(result.padDelta.arousal, fixture.expected.pad.arousal, `${fixture.id} padDelta.arousal`);
    assertBand(result.padDelta.dominance, fixture.expected.pad.dominance, `${fixture.id} padDelta.dominance`);

    assertBand(result.pairDelta.trust, fixture.expected.pair.trust, `${fixture.id} pairDelta.trust`);
    assertBand(result.pairDelta.affinity, fixture.expected.pair.affinity, `${fixture.id} pairDelta.affinity`);
    assertBand(
      result.pairDelta.conflict,
      fixture.expected.pair.conflict,
      `${fixture.id} pairDelta.conflict`
    );
    assertBand(
      result.pairDelta.intimacyReadiness,
      fixture.expected.pair.intimacyReadiness,
      `${fixture.id} pairDelta.intimacyReadiness`
    );
  });
}

test('affectionate carry-over keeps positive slow mood active on a warm follow-up turn', () => {
  const appraisal = buildAppraisal({
    warmthImpact: 0.34,
    rejectionImpact: -0.05,
    respectImpact: 0.32,
    threatImpact: -0.12,
    pressureImpact: 0.02,
    repairImpact: 0.1,
    reciprocityImpact: 0.28,
    intimacySignal: 0.38,
    boundarySignal: 0.32,
    certainty: 0.82,
  });

  const carried = integrateCoEAppraisal({
    currentEmotion: buildEmotion({
      fastAffect: { pleasure: 0.46, arousal: 0.2, dominance: 0.18 },
      slowMood: { pleasure: 0.42, arousal: 0.08, dominance: 0.16 },
      combined: { pleasure: 0.44, arousal: 0.15, dominance: 0.17 },
    }),
    currentMetrics: buildMetrics({ trust: 72, affinity: 78, conflict: 4, intimacyReadiness: 34 }),
    appraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [
      buildAct({ act: 'affection', target: 'relationship', polarity: 'positive', intensity: 0.7 }),
    ],
  });
  const neutral = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 72, affinity: 78, conflict: 4, intimacyReadiness: 34 }),
    appraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [
      buildAct({ act: 'affection', target: 'relationship', polarity: 'positive', intensity: 0.7 }),
    ],
  });

  assert.ok(carried.after.combined.pleasure > neutral.after.combined.pleasure);
  assert.ok(carried.after.slowMood.pleasure > neutral.after.slowMood.pleasure);
  assert.equal(carried.pairDelta.intimacyReadiness, neutral.pairDelta.intimacyReadiness);
});

test('open-thread bias lowers pleasure/trust and raises conflict for the same appraisal', () => {
  const appraisal = buildAppraisal({
    warmthImpact: 0.42,
    rejectionImpact: -0.08,
    respectImpact: 0.28,
    threatImpact: -0.08,
    pressureImpact: 0.02,
    repairImpact: 0.2,
    reciprocityImpact: 0.3,
    intimacySignal: 0.22,
    boundarySignal: 0.26,
    certainty: 0.8,
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

  assert.ok(threaded.padDelta.pleasure < clear.padDelta.pleasure);
  assert.ok(threaded.pairDelta.trust < clear.pairDelta.trust);
  assert.ok(threaded.pairDelta.affinity < clear.pairDelta.affinity);
  assert.ok(threaded.pairDelta.conflict > clear.pairDelta.conflict);
});

test('consent boundary guardrail remains narrow and deterministic in entry phase', () => {
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics({ trust: 40, affinity: 44, conflict: 6, intimacyReadiness: 8 }),
    appraisal: buildAppraisal({
      warmthImpact: 0.1,
      rejectionImpact: 0.12,
      respectImpact: -0.52,
      threatImpact: 0.5,
      pressureImpact: 0.44,
      repairImpact: 0,
      reciprocityImpact: 0.08,
      intimacySignal: 0.82,
      boundarySignal: -0.52,
      certainty: 0.88,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    interactionActs: [
      buildAct({ act: 'intimacy_bid', target: 'boundary', polarity: 'mixed', intensity: 0.92 }),
    ],
  });

  assert.ok(result.appliedGuardrails.includes('consentBoundary'));
  assert.ok(result.pairDelta.intimacyReadiness <= 0);
  assert.ok(result.pairDelta.conflict > 0);
  assert.ok(result.padDelta.pleasure < 0);
});

test('integrator is deterministic and does not mutate inputs without injected clock', async () => {
  const currentEmotion = buildEmotion();
  const currentMetrics = buildMetrics();
  const appraisal = buildAppraisal({
    warmthImpact: 0.22,
    reciprocityImpact: 0.18,
    respectImpact: 0.14,
    certainty: 0.79,
  });
  const input = {
    currentEmotion,
    currentMetrics,
    appraisal,
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [] as OpenThread[],
    turnsSinceLastUpdate: 1,
  };
  const snapshot = JSON.stringify(input);

  const first = integrateCoEAppraisal(input);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = integrateCoEAppraisal(input);

  assert.deepEqual(first.after, second.after);
  assert.deepEqual(first.pairDelta, second.pairDelta);
  assert.equal(
    first.after.lastUpdatedAt.toISOString(),
    currentEmotion.lastUpdatedAt.toISOString()
  );
  assert.equal(JSON.stringify(input), snapshot);
});

test('integrator uses injected now from caller when provided', () => {
  const injectedNow = new Date('2026-03-26T01:02:03.000Z');
  const result = integrateCoEAppraisal({
    currentEmotion: buildEmotion(),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal({
      warmthImpact: 0.2,
      respectImpact: 0.18,
      reciprocityImpact: 0.12,
      certainty: 0.8,
    }),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    now: injectedNow,
  });

  assert.equal(result.after.lastUpdatedAt.toISOString(), injectedNow.toISOString());
});

test('integrator runs as a plain-object unit with no runtime container dependencies', () => {
  const plainInput = {
    currentEmotion: {
      fastAffect: { pleasure: 0.1, arousal: 0, dominance: 0.05 },
      slowMood: { pleasure: 0.1, arousal: 0, dominance: 0.05 },
      combined: { pleasure: 0.1, arousal: 0, dominance: 0.05 },
      lastUpdatedAt: new Date('2026-03-25T00:00:00.000Z'),
    },
    currentMetrics: {
      trust: 50,
      affinity: 50,
      conflict: 0,
      intimacyReadiness: 10,
    },
    appraisal: {
      warmthImpact: 0.3,
      rejectionImpact: -0.05,
      respectImpact: 0.25,
      threatImpact: -0.1,
      pressureImpact: 0,
      repairImpact: 0.1,
      reciprocityImpact: 0.2,
      intimacySignal: 0.15,
      boundarySignal: 0.2,
      certainty: 0.78,
    },
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
  };

  const result = integrateCoEAppraisal(plainInput);

  assert.equal(typeof result.padDelta.pleasure, 'number');
  assert.equal(typeof result.pairDelta.trust, 'number');
  assert.ok(Array.isArray(result.contributions));
});
