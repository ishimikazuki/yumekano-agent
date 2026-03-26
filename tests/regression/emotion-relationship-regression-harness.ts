import { computeAppraisal } from '@/lib/rules/appraisal';
import { buildCoEExplanation } from '@/lib/rules/coe';
import { updatePAD } from '@/lib/rules/pad';
import { updateRelationshipMetrics } from '@/lib/rules/phase-runtime';
import type { PADState, PairState, WorkingMemory } from '@/lib/schemas';
import { createCharacterVersion, createPairState, createPhaseNode, createWorkingMemory } from '../persona-test-helpers';
import type {
  CoEReasonExpectation,
  EmotionRelationshipRegressionFixture,
  NumericBand,
  PairDeltaBand,
  PADDeltaBand,
  RegressionFixtureTurn,
} from '../fixtures/emotion-relationship-regression-fixtures';

type AxisKey = keyof PADState;
type PairMetricKey = keyof Pick<
  PairState,
  'affinity' | 'trust' | 'intimacyReadiness' | 'conflict'
>;

export type RegressionTurnResult = {
  index: number;
  message: string;
  padDelta: PADState;
  pairDelta: Record<PairMetricKey, number>;
  topDriverKeys: string[];
  axisDriverKeys: Record<AxisKey, string[]>;
};

export type RegressionFixtureResult = {
  fixtureId: string;
  turns: RegressionTurnResult[];
  cumulativePadDelta: PADState;
  cumulativePairDelta: Record<PairMetricKey, number>;
};

const FIXED_NOW = new Date('2026-03-25T00:00:00.000Z');

function round(value: number): number {
  return Number(value.toFixed(3));
}

function formatBand(band: NumericBand): string {
  return `[${band.min.toFixed(3)}, ${band.max.toFixed(3)}]`;
}

function inBand(value: number, band: NumericBand): boolean {
  return value >= band.min && value <= band.max;
}

function buildPairState(base: PairState, overrides?: Partial<PairState>): PairState {
  return {
    ...base,
    ...overrides,
  };
}

function buildWorkingMemory(
  base: WorkingMemory,
  overrides?: Partial<WorkingMemory>
): WorkingMemory {
  return {
    ...base,
    ...overrides,
  };
}

export function runEmotionRelationshipFixture(
  fixture: EmotionRelationshipRegressionFixture
): RegressionFixtureResult {
  const characterVersion = createCharacterVersion();
  const initialPairState = createPairState(fixture.basePairOverrides ?? {});
  const initialPad = initialPairState.emotion.combined;
  const initialMetrics = {
    affinity: initialPairState.affinity,
    trust: initialPairState.trust,
    intimacyReadiness: initialPairState.intimacyReadiness,
    conflict: initialPairState.conflict,
  };

  let pairState = initialPairState;
  let workingMemory = buildWorkingMemory(
    createWorkingMemory(),
    fixture.baseWorkingMemoryOverrides
  );
  const dialogue = [...(fixture.seedDialogue ?? [])];
  const turns: RegressionTurnResult[] = [];

  for (const [index, turn] of fixture.turns.entries()) {
    const phase = createPhaseNode();
    phase.adultIntimacyEligibility =
      turn.phaseEligibility ?? fixture.basePhaseEligibility ?? 'conditional';

    pairState = buildPairState(pairState, turn.pairOverrides);
    workingMemory = buildWorkingMemory(workingMemory, turn.workingMemoryOverrides);

    const openThreads = turn.openThreads ?? fixture.baseOpenThreads ?? [];
    const appraisal = computeAppraisal({
      userMessage: turn.userMessage,
      characterVersion,
      pairState,
      workingMemory,
      openThreads,
      recentDialogue: dialogue,
      currentPhase: phase,
    });

    const emotionBefore = pairState.emotion.combined;
    const padUpdate = updatePAD({
      currentEmotion: pairState.emotion,
      appraisal,
      emotionSpec: characterVersion.emotion,
      hasOpenThreads: openThreads.length > 0,
      turnsSinceLastUpdate: 1,
      now: FIXED_NOW,
    });

    const relationshipAfter = updateRelationshipMetrics({
      current: pairState,
      appraisal,
      emotionBefore,
      emotionAfter: padUpdate.after.combined,
    });

    const coe = buildCoEExplanation({
      emotionBefore,
      emotionAfter: padUpdate.after.combined,
      emotionBeforeState: pairState.emotion,
      emotionAfterState: padUpdate.after,
      appraisal,
      contributions: padUpdate.contributions,
    });

    const pairDelta = {
      affinity: round(relationshipAfter.affinity - pairState.affinity),
      trust: round(relationshipAfter.trust - pairState.trust),
      intimacyReadiness: round(
        relationshipAfter.intimacyReadiness - pairState.intimacyReadiness
      ),
      conflict: round(relationshipAfter.conflict - pairState.conflict),
    };

    const padDelta = {
      pleasure: round(padUpdate.after.combined.pleasure - emotionBefore.pleasure),
      arousal: round(padUpdate.after.combined.arousal - emotionBefore.arousal),
      dominance: round(padUpdate.after.combined.dominance - emotionBefore.dominance),
    };

    turns.push({
      index: index + 1,
      message: turn.userMessage,
      padDelta,
      pairDelta,
      topDriverKeys: coe.topDrivers.map((driver) => driver.factorKey),
      axisDriverKeys: {
        pleasure:
          coe.axisSummaries
            .find((summary) => summary.axis === 'pleasure')
            ?.topDrivers.map((driver) => driver.factorKey) ?? [],
        arousal:
          coe.axisSummaries
            .find((summary) => summary.axis === 'arousal')
            ?.topDrivers.map((driver) => driver.factorKey) ?? [],
        dominance:
          coe.axisSummaries
            .find((summary) => summary.axis === 'dominance')
            ?.topDrivers.map((driver) => driver.factorKey) ?? [],
      },
    });

    pairState = {
      ...pairState,
      ...relationshipAfter,
      emotion: padUpdate.after,
      pad: padUpdate.after.combined,
      appraisal,
      openThreadCount: openThreads.length,
      updatedAt: FIXED_NOW,
    };

    dialogue.push({ role: 'user', content: turn.userMessage });
    dialogue.push({ role: 'assistant', content: turn.assistantReply ?? '…' });
  }

  return {
    fixtureId: fixture.id,
    turns,
    cumulativePadDelta: {
      pleasure: round(pairState.emotion.combined.pleasure - initialPad.pleasure),
      arousal: round(pairState.emotion.combined.arousal - initialPad.arousal),
      dominance: round(pairState.emotion.combined.dominance - initialPad.dominance),
    },
    cumulativePairDelta: {
      affinity: round(pairState.affinity - initialMetrics.affinity),
      trust: round(pairState.trust - initialMetrics.trust),
      intimacyReadiness: round(
        pairState.intimacyReadiness - initialMetrics.intimacyReadiness
      ),
      conflict: round(pairState.conflict - initialMetrics.conflict),
    },
  };
}

function comparePadBand(
  label: string,
  actual: PADState,
  expected: PADDeltaBand,
  mismatches: string[]
): void {
  (Object.keys(expected) as AxisKey[]).forEach((axis) => {
    if (!inBand(actual[axis], expected[axis])) {
      mismatches.push(
        `${label} PAD ${axis} expected ${formatBand(expected[axis])}, got ${actual[
          axis
        ].toFixed(3)}`
      );
    }
  });
}

function comparePairBand(
  label: string,
  actual: Record<PairMetricKey, number>,
  expected: PairDeltaBand,
  mismatches: string[]
): void {
  (Object.keys(expected) as PairMetricKey[]).forEach((metric) => {
    if (!inBand(actual[metric], expected[metric])) {
      mismatches.push(
        `${label} pair ${metric} expected ${formatBand(expected[metric])}, got ${actual[
          metric
        ].toFixed(3)}`
      );
    }
  });
}

function compareCoEReasons(
  label: string,
  turnResult: RegressionTurnResult,
  expected: CoEReasonExpectation,
  mismatches: string[]
): void {
  for (const expectedDriver of expected.topDriverKeys) {
    if (!turnResult.topDriverKeys.includes(expectedDriver)) {
      mismatches.push(
        `${label} CoE top drivers missing ${expectedDriver}; actual: ${turnResult.topDriverKeys.join(
          ', '
        )}`
      );
    }
  }

  for (const [axis, expectedDrivers] of Object.entries(
    expected.axisDriverKeys ?? {}
  ) as Array<[AxisKey, string[]]>) {
    const actual = turnResult.axisDriverKeys[axis];
    for (const expectedDriver of expectedDrivers) {
      if (!actual.includes(expectedDriver)) {
        mismatches.push(
          `${label} CoE ${axis} drivers missing ${expectedDriver}; actual: ${actual.join(
            ', '
          )}`
        );
      }
    }
  }
}

function compareTurnExpectation(
  turn: RegressionFixtureTurn,
  turnResult: RegressionTurnResult,
  mismatches: string[]
): void {
  if (!turn.expect) {
    return;
  }

  const label = `turn ${turnResult.index}`;
  comparePadBand(label, turnResult.padDelta, turn.expect.padDelta, mismatches);
  comparePairBand(label, turnResult.pairDelta, turn.expect.pairDelta, mismatches);
  compareCoEReasons(label, turnResult, turn.expect.coeReasons, mismatches);
}

export function collectFixtureMismatches(
  fixture: EmotionRelationshipRegressionFixture,
  result: RegressionFixtureResult
): string[] {
  const mismatches: string[] = [];

  fixture.turns.forEach((turn, index) => {
    compareTurnExpectation(turn, result.turns[index], mismatches);
  });

  if (fixture.cumulativeExpectation?.padDelta) {
    comparePadBand(
      'cumulative',
      result.cumulativePadDelta,
      fixture.cumulativeExpectation.padDelta,
      mismatches
    );
  }

  if (fixture.cumulativeExpectation?.pairDelta) {
    comparePairBand(
      'cumulative',
      result.cumulativePairDelta,
      fixture.cumulativeExpectation.pairDelta,
      mismatches
    );
  }

  return mismatches;
}
