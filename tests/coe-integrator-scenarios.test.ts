/**
 * CoE Integrator Scenario Tests
 *
 * These tests validate the NEW emotion path (CoE integrator) using
 * hand-crafted extraction fixtures that represent what the LLM
 * evidence extractor would produce for each scenario.
 *
 * Once all 10 scenarios pass, the old heuristic path can be safely removed.
 */
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

const FIXED_NOW = new Date('2026-03-25T00:00:00.000Z');

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

function inBand(value: number, band: NumericBand): boolean {
  return value >= band.min && value <= band.max;
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

function buildAct(overrides: Partial<ExtractedInteractionAct>): ExtractedInteractionAct {
  return {
    act: 'other',
    target: 'unknown',
    polarity: 'neutral',
    intensity: 0.5,
    evidenceSpans: [{ source: 'user_message', sourceId: null, text: 'stub', start: 0, end: 4 }],
    confidence: 0.9,
    uncertaintyNotes: [],
    ...overrides,
  };
}

function buildEmotion(pad?: Partial<{ pleasure: number; arousal: number; dominance: number }>): RuntimeEmotionState {
  return createRuntimeEmotionState(
    { pleasure: pad?.pleasure ?? 0.1, arousal: pad?.arousal ?? 0, dominance: pad?.dominance ?? 0.05 },
    FIXED_NOW,
  );
}

function buildMetrics(overrides?: Partial<RelationshipMetrics>): RelationshipMetrics {
  return { trust: 50, affinity: 50, conflict: 0, intimacyReadiness: 10, ...overrides };
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
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

const RELATIONSHIP_PHASE = { mode: 'relationship' as const, adultIntimacyEligibility: 'conditional' as const };
const ENTRY_PHASE = { mode: 'entry' as const, adultIntimacyEligibility: 'never' as const };

// ─── Scenario definitions ───────────────────────────────────────
// Each scenario has:
//   - extraction: what the LLM evidence extractor would produce
//   - context: pair state at the time of the turn
//   - expected: PAD delta and pair metric delta bands

const scenarios = [
  {
    id: 'compliment',
    title: 'Warm praise should improve PAD and pair metrics',
    context: {
      emotion: buildEmotion({ pleasure: 0.2, arousal: 0.1, dominance: 0.05 }),
      metrics: buildMetrics({ trust: 64, affinity: 66, intimacyReadiness: 34, conflict: 6 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: 0.65,
        respectImpact: 0.5,
        reciprocityImpact: 0.4,
        intimacySignal: 0.3,
        boundarySignal: 0.1,
        certainty: 0.88,
      }),
      acts: [
        buildAct({ act: 'compliment', target: 'character', polarity: 'positive', intensity: 0.75 }),
        buildAct({ act: 'affection', target: 'character', polarity: 'positive', intensity: 0.5 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: 0.05, max: 0.35 },
        arousal: { min: -0.05, max: 0.15 },
        dominance: { min: -0.05, max: 0.20 },
      },
      pair: {
        affinity: { min: 1, max: 10 },
        trust: { min: 0.5, max: 8 },
        intimacyReadiness: { min: 0.5, max: 8 },
        conflict: { min: -3, max: 0 },
      },
    },
  },
  {
    id: 'mild-rejection',
    title: 'Soft decline should sting and cool intimacy',
    context: {
      emotion: buildEmotion({ pleasure: 0.15, arousal: 0.1, dominance: 0.0 }),
      metrics: buildMetrics({ trust: 63, affinity: 65, intimacyReadiness: 30, conflict: 5 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: -0.15,
        rejectionImpact: 0.45,
        respectImpact: -0.1,
        reciprocityImpact: -0.25,
        intimacySignal: -0.2,
        boundarySignal: -0.1,
        certainty: 0.82,
      }),
      acts: [
        buildAct({ act: 'rejection', target: 'relationship', polarity: 'negative', intensity: 0.45 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: -0.25, max: -0.02 },
        arousal: { min: -0.05, max: 0.1 },
        dominance: { min: -0.15, max: 0.05 },
      },
      pair: {
        affinity: { min: -5, max: 0 },
        trust: { min: -5, max: 0 },
        intimacyReadiness: { min: -5, max: 0 },
        conflict: { min: 0, max: 5 },
      },
    },
  },
  {
    id: 'explicit-insult',
    title: 'Direct contempt should strongly hurt pleasure, dominance, and trust',
    context: {
      emotion: buildEmotion({ pleasure: 0.1, arousal: 0.05, dominance: 0.0 }),
      metrics: buildMetrics({ trust: 60, affinity: 61, intimacyReadiness: 28, conflict: 12 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
    },
    extraction: {
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
      acts: [
        buildAct({ act: 'insult', target: 'character', polarity: 'negative', intensity: 0.95 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: -0.95, max: -0.3 },
        arousal: { min: 0.1, max: 0.5 },
        dominance: { min: -0.85, max: -0.2 },
      },
      pair: {
        affinity: { min: -20, max: -2 },
        trust: { min: -22, max: -2 },
        intimacyReadiness: { min: -10, max: 0 },
        conflict: { min: 3, max: 25 },
      },
    },
  },
  {
    id: 'apology-repair',
    title: 'Clear apology under tension should repair trust and reduce conflict',
    context: {
      emotion: buildEmotion({ pleasure: -0.1, arousal: 0.15, dominance: -0.05 }),
      metrics: buildMetrics({ trust: 53, affinity: 55, intimacyReadiness: 18, conflict: 22 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [buildOpenThread({ key: 'repair_needed', summary: 'さっきの言い方で傷つけたまま', severity: 0.72 })],
    },
    extraction: {
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
      acts: [
        buildAct({ act: 'apology', target: 'relationship', polarity: 'positive', intensity: 0.84 }),
        buildAct({ act: 'repair', target: 'relationship', polarity: 'positive', intensity: 0.78 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: 0.05, max: 0.5 },
        arousal: { min: -0.3, max: 0.05 },
        dominance: { min: 0.0, max: 0.45 },
      },
      pair: {
        affinity: { min: 1, max: 10 },
        trust: { min: 2, max: 14 },
        intimacyReadiness: { min: 0, max: 8 },
        conflict: { min: -10, max: -1 },
      },
    },
  },
  {
    id: 'repeated-pressure',
    title: 'Repeated demands should sharply raise conflict and drop trust',
    context: {
      emotion: buildEmotion({ pleasure: 0.01, arousal: 0.12, dominance: 0.01 }),
      metrics: buildMetrics({ trust: 47, affinity: 45, intimacyReadiness: 10, conflict: 14 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [buildOpenThread({ severity: 0.8 })],
    },
    extraction: {
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
      acts: [
        buildAct({ act: 'pressure', target: 'character', polarity: 'negative', intensity: 0.82 }),
        buildAct({ act: 'intimacy_bid', target: 'character', polarity: 'negative', intensity: 0.6 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: -0.75, max: -0.1 },
        arousal: { min: 0.05, max: 0.45 },
        dominance: { min: -0.65, max: -0.08 },
      },
      pair: {
        affinity: { min: -15, max: -2 },
        trust: { min: -18, max: -3 },
        intimacyReadiness: { min: -12, max: -1 },
        conflict: { min: 4, max: 22 },
      },
    },
  },
  {
    id: 'intimacy-escalation-positive-context',
    title: 'Safe intimacy bids should warm intimacy readiness without triggering threat',
    context: {
      emotion: buildEmotion({ pleasure: 0.25, arousal: 0.08, dominance: 0.1 }),
      metrics: buildMetrics({ trust: 76, affinity: 78, intimacyReadiness: 62, conflict: 3 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: 0.55,
        respectImpact: 0.45,
        reciprocityImpact: 0.35,
        intimacySignal: 0.6,
        boundarySignal: 0.3,
        certainty: 0.85,
      }),
      acts: [
        buildAct({ act: 'intimacy_bid', target: 'relationship', polarity: 'positive', intensity: 0.6 }),
        buildAct({ act: 'support', target: 'character', polarity: 'positive', intensity: 0.5 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: 0.02, max: 0.3 },
        arousal: { min: -0.05, max: 0.15 },
        dominance: { min: -0.02, max: 0.25 },
      },
      pair: {
        affinity: { min: 0.5, max: 8 },
        trust: { min: 0.5, max: 8 },
        intimacyReadiness: { min: 1, max: 12 },
        conflict: { min: -3, max: 0 },
      },
    },
  },
  {
    id: 'intimacy-escalation-across-boundary',
    title: 'Boundary-crossing intimacy should register as pressure and norm violation',
    context: {
      emotion: buildEmotion({ pleasure: -0.05, arousal: 0.15, dominance: -0.08 }),
      metrics: buildMetrics({ trust: 38, affinity: 35, intimacyReadiness: 12, conflict: 18 }),
      phase: ENTRY_PHASE,
      openThreads: [] as OpenThread[],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: -0.6,
        rejectionImpact: 0.1,
        respectImpact: -0.7,
        threatImpact: 0.75,
        pressureImpact: 0.85,
        repairImpact: -0.3,
        reciprocityImpact: -0.4,
        intimacySignal: 0.15,
        boundarySignal: -0.8,
        certainty: 0.94,
      }),
      acts: [
        buildAct({ act: 'pressure', target: 'character', polarity: 'negative', intensity: 0.9 }),
        buildAct({ act: 'boundary_test', target: 'character', polarity: 'negative', intensity: 0.85 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: -0.8, max: -0.1 },
        arousal: { min: 0.05, max: 0.45 },
        dominance: { min: -0.7, max: -0.1 },
      },
      pair: {
        affinity: { min: -15, max: -2 },
        trust: { min: -18, max: -3 },
        intimacyReadiness: { min: -12, max: 0 },
        conflict: { min: 4, max: 22 },
      },
    },
  },
  {
    id: 'topic-shift-after-tension',
    title: 'Subject change after friction should cool conflict',
    context: {
      emotion: buildEmotion({ pleasure: -0.05, arousal: 0.12, dominance: -0.02 }),
      metrics: buildMetrics({ trust: 55, affinity: 57, intimacyReadiness: 24, conflict: 28 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [buildOpenThread({ key: 'awkwardness', summary: '会話が少し気まずいまま', severity: 0.5 })],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: 0.05,
        rejectionImpact: 0.0,
        respectImpact: 0.1,
        threatImpact: -0.1,
        pressureImpact: -0.15,
        repairImpact: 0.15,
        reciprocityImpact: 0.05,
        intimacySignal: 0.0,
        boundarySignal: 0.05,
        certainty: 0.7,
      }),
      acts: [
        buildAct({ act: 'topic_shift', target: 'relationship', polarity: 'neutral', intensity: 0.3 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: -0.08, max: 0.12 },
        arousal: { min: -0.15, max: 0.05 },
        dominance: { min: -0.05, max: 0.1 },
      },
      pair: {
        affinity: { min: -1, max: 3 },
        trust: { min: -1, max: 3 },
        intimacyReadiness: { min: -1, max: 2 },
        conflict: { min: -5, max: 1 },
      },
    },
  },
  {
    id: 'two-turn-carry-over-insult',
    title: 'Insult in two-turn scenario should hurt metrics (turn 1 of 2)',
    context: {
      emotion: buildEmotion({ pleasure: 0.1, arousal: 0.05, dominance: 0.0 }),
      metrics: buildMetrics({ trust: 57, affinity: 62, intimacyReadiness: 31, conflict: 14 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [buildOpenThread({ key: 'repair_needed', summary: 'さっきの言い方の後味が悪い', severity: 0.66 })],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: -0.8,
        rejectionImpact: 0.65,
        respectImpact: -0.85,
        threatImpact: 0.55,
        pressureImpact: 0.35,
        repairImpact: -0.35,
        reciprocityImpact: -0.45,
        intimacySignal: -0.15,
        boundarySignal: -0.5,
        certainty: 0.9,
      }),
      acts: [
        buildAct({ act: 'insult', target: 'character', polarity: 'negative', intensity: 0.88 }),
        buildAct({ act: 'disengagement', target: 'relationship', polarity: 'negative', intensity: 0.7 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: -0.9, max: -0.15 },
        arousal: { min: 0.05, max: 0.45 },
        dominance: { min: -0.8, max: -0.1 },
      },
      pair: {
        affinity: { min: -18, max: -1.5 },
        trust: { min: -18, max: -1.5 },
        intimacyReadiness: { min: -10, max: 0 },
        conflict: { min: 2, max: 22 },
      },
    },
  },
  {
    id: 'five-turn-single-support',
    title: 'Single supportive turn should produce a small positive shift',
    context: {
      emotion: buildEmotion({ pleasure: 0.15, arousal: 0.03, dominance: 0.08 }),
      metrics: buildMetrics({ trust: 54, affinity: 56, intimacyReadiness: 22, conflict: 6 }),
      phase: RELATIONSHIP_PHASE,
      openThreads: [] as OpenThread[],
    },
    extraction: {
      appraisal: buildAppraisal({
        warmthImpact: 0.4,
        respectImpact: 0.35,
        reciprocityImpact: 0.25,
        intimacySignal: 0.15,
        boundarySignal: 0.1,
        certainty: 0.82,
      }),
      acts: [
        buildAct({ act: 'support', target: 'character', polarity: 'positive', intensity: 0.55 }),
        buildAct({ act: 'compliment', target: 'character', polarity: 'positive', intensity: 0.4 }),
      ],
    },
    expected: {
      pad: {
        pleasure: { min: 0.02, max: 0.25 },
        arousal: { min: -0.05, max: 0.1 },
        dominance: { min: -0.03, max: 0.15 },
      },
      pair: {
        affinity: { min: 0.3, max: 7 },
        trust: { min: 0.3, max: 7 },
        intimacyReadiness: { min: 0, max: 6 },
        conflict: { min: -3, max: 0 },
      },
    },
  },
];

// ─── Run tests ──────────────────────────────────────────────────

for (const scenario of scenarios) {
  test(`CoE integrator scenario: ${scenario.id} — ${scenario.title}`, () => {
    const result = integrateCoEAppraisal({
      currentEmotion: scenario.context.emotion,
      currentMetrics: scenario.context.metrics,
      appraisal: scenario.extraction.appraisal,
      emotionSpec: DEFAULT_EMOTION_SPEC,
      currentPhase: scenario.context.phase,
      openThreads: scenario.context.openThreads,
      turnsSinceLastUpdate: 1,
      interactionActs: scenario.extraction.acts,
      now: FIXED_NOW,
    });

    const padBefore = scenario.context.emotion.combined;
    const padAfter = result.after.combined;
    const padDelta = {
      pleasure: padAfter.pleasure - padBefore.pleasure,
      arousal: padAfter.arousal - padBefore.arousal,
      dominance: padAfter.dominance - padBefore.dominance,
    };

    const pairDelta = {
      affinity: result.relationshipAfter.affinity - scenario.context.metrics.affinity,
      trust: result.relationshipAfter.trust - scenario.context.metrics.trust,
      intimacyReadiness: result.relationshipAfter.intimacyReadiness - scenario.context.metrics.intimacyReadiness,
      conflict: result.relationshipAfter.conflict - scenario.context.metrics.conflict,
    };

    const mismatches: string[] = [];

    // Check PAD deltas
    for (const axis of ['pleasure', 'arousal', 'dominance'] as const) {
      const value = padDelta[axis];
      const band = scenario.expected.pad[axis];
      if (!inBand(value, band)) {
        mismatches.push(
          `PAD ${axis}: got ${value.toFixed(4)}, expected [${band.min}, ${band.max}]`
        );
      }
    }

    // Check pair metric deltas
    for (const metric of ['affinity', 'trust', 'intimacyReadiness', 'conflict'] as const) {
      const value = pairDelta[metric];
      const band = scenario.expected.pair[metric];
      if (!inBand(value, band)) {
        mismatches.push(
          `pair ${metric}: got ${value.toFixed(4)}, expected [${band.min}, ${band.max}]`
        );
      }
    }

    assert.equal(
      mismatches.length,
      0,
      `${scenario.id}: ${mismatches.length} mismatches\n${mismatches.join('\n')}`
    );
  });
}
