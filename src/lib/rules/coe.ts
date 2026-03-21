import type { AppraisalVector, PADState } from '../schemas';

type AxisKey = keyof PADState;
type FactorKey = keyof AppraisalVector | 'uncertainty';

const AXIS_LABELS: Record<AxisKey, string> = {
  pleasure: 'Pleasure',
  arousal: 'Arousal',
  dominance: 'Dominance',
};

const AXIS_SHORT_LABELS: Record<AxisKey, string> = {
  pleasure: 'P',
  arousal: 'A',
  dominance: 'D',
};

const FACTOR_LABELS: Record<FactorKey, string> = {
  goalCongruence: '目標一致',
  controllability: '制御可能性',
  certainty: '確実性',
  normAlignment: '規範整合',
  attachmentSecurity: '愛着安定',
  reciprocity: '相互性',
  pressureIntrusiveness: '圧力/侵襲性',
  novelty: '新規性',
  selfRelevance: '自己関連性',
  uncertainty: '不確実性',
};

export type CoEDriver = {
  axis: AxisKey;
  axisLabel: string;
  axisShortLabel: string;
  factorKey: FactorKey;
  factorLabel: string;
  factorValue: number;
  contribution: number;
};

export type CoEAxisSummary = {
  axis: AxisKey;
  axisLabel: string;
  axisShortLabel: string;
  before: number;
  after: number;
  delta: number;
  topDrivers: CoEDriver[];
};

export type CoEExplanation = {
  summary: string;
  delta: PADState;
  intentReason: string | null;
  intentDelta: PADState | null;
  topDrivers: CoEDriver[];
  axisSummaries: CoEAxisSummary[];
};

type CoEInput = {
  emotionBefore: PADState;
  emotionAfter: PADState;
  appraisal: AppraisalVector;
  intentReason?: string | null;
  intentDelta?: PADState | null;
};

const DRIVER_COUNT = 3;
const AXIS_DRIVER_COUNT = 2;
const NEUTRAL_DELTA_THRESHOLD = 0.03;

/**
 * Build an explainable CoE (Chain of Emotion) summary for designer-facing UI.
 */
export function buildCoEExplanation(input: CoEInput): CoEExplanation {
  const { emotionBefore, emotionAfter, appraisal, intentReason = null, intentDelta = null } = input;
  const delta: PADState = {
    pleasure: emotionAfter.pleasure - emotionBefore.pleasure,
    arousal: emotionAfter.arousal - emotionBefore.arousal,
    dominance: emotionAfter.dominance - emotionBefore.dominance,
  };

  const byAxis: Record<AxisKey, CoEDriver[]> = {
    pleasure: [
      createDriver('pleasure', 'goalCongruence', appraisal.goalCongruence, appraisal.goalCongruence * 0.4),
      createDriver('pleasure', 'reciprocity', appraisal.reciprocity, appraisal.reciprocity * 0.2),
      createDriver(
        'pleasure',
        'attachmentSecurity',
        appraisal.attachmentSecurity,
        appraisal.attachmentSecurity * 0.2
      ),
      createDriver(
        'pleasure',
        'pressureIntrusiveness',
        appraisal.pressureIntrusiveness,
        appraisal.pressureIntrusiveness * -0.3
      ),
      createDriver('pleasure', 'normAlignment', appraisal.normAlignment, appraisal.normAlignment * 0.15),
    ],
    arousal: [
      createDriver('arousal', 'novelty', appraisal.novelty, appraisal.novelty * 0.3),
      createDriver('arousal', 'selfRelevance', appraisal.selfRelevance, appraisal.selfRelevance * 0.2),
      createDriver(
        'arousal',
        'pressureIntrusiveness',
        appraisal.pressureIntrusiveness,
        appraisal.pressureIntrusiveness * 0.25
      ),
      createDriver('arousal', 'uncertainty', 1 - appraisal.certainty, (1 - appraisal.certainty) * 0.15),
    ],
    dominance: [
      createDriver(
        'dominance',
        'controllability',
        appraisal.controllability,
        appraisal.controllability * 0.35
      ),
      createDriver('dominance', 'certainty', appraisal.certainty, appraisal.certainty * 0.15),
      createDriver(
        'dominance',
        'pressureIntrusiveness',
        appraisal.pressureIntrusiveness,
        appraisal.pressureIntrusiveness * -0.3
      ),
    ],
  };

  const topDrivers = Object.values(byAxis)
    .flat()
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, DRIVER_COUNT);

  const axisSummaries: CoEAxisSummary[] = (['pleasure', 'arousal', 'dominance'] as const).map((axis) => ({
    axis,
    axisLabel: AXIS_LABELS[axis],
    axisShortLabel: AXIS_SHORT_LABELS[axis],
    before: emotionBefore[axis],
    after: emotionAfter[axis],
    delta: delta[axis],
    topDrivers: [...byAxis[axis]]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, AXIS_DRIVER_COUNT),
  }));

  return {
    summary: buildSummary(delta, topDrivers, intentReason),
    delta,
    intentReason,
    intentDelta,
    topDrivers,
    axisSummaries,
  };
}

function createDriver(
  axis: AxisKey,
  factorKey: FactorKey,
  factorValue: number,
  contribution: number
): CoEDriver {
  return {
    axis,
    axisLabel: AXIS_LABELS[axis],
    axisShortLabel: AXIS_SHORT_LABELS[axis],
    factorKey,
    factorLabel: FACTOR_LABELS[factorKey],
    factorValue,
    contribution,
  };
}

function buildSummary(delta: PADState, topDrivers: CoEDriver[], intentReason: string | null): string {
  const deltaSummary = `P${formatSigned(delta.pleasure)} / A${formatSigned(delta.arousal)} / D${formatSigned(delta.dominance)}`;

  const hasMeaningfulChange =
    Math.abs(delta.pleasure) >= NEUTRAL_DELTA_THRESHOLD ||
    Math.abs(delta.arousal) >= NEUTRAL_DELTA_THRESHOLD ||
    Math.abs(delta.dominance) >= NEUTRAL_DELTA_THRESHOLD;

  const lead = hasMeaningfulChange
    ? `PADが変化 (${deltaSummary})。`
    : `PADはほぼ安定 (${deltaSummary})。`;

  const driverText =
    topDrivers.length > 0
      ? `主因: ${topDrivers
          .slice(0, 2)
          .map((driver) => `${driver.factorLabel}${formatSigned(driver.contribution)}`)
          .join('、')}。`
      : '';

  const intentText = intentReason ? `Planner意図: ${intentReason}` : '';

  return [lead, driverText, intentText].filter(Boolean).join(' ');
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}
