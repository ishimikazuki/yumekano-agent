import type {
  AppraisalVector,
  PADState,
  RuntimeEmotionState,
  PADTransitionContribution,
} from '../schemas';
import {
  getPADContributions,
  PAD_DELTA_NOTICE_THRESHOLD,
  type PADContributionFactorKey,
  getPADEmotionLabel,
} from './pad';

type AxisKey = keyof PADState;
type FactorKey = PADContributionFactorKey;

const AXIS_LABELS: Record<AxisKey, string> = {
  pleasure: '快',
  arousal: '覚醒',
  dominance: '支配感',
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
  policySummary: string | null;
  intentDelta: PADState | null;
  beforeEmotionLabel: string;
  afterEmotionLabel: string;
  beforeEmotionDescription: string;
  afterEmotionDescription: string;
  movementNarrative: string[];
  topDrivers: CoEDriver[];
  axisSummaries: CoEAxisSummary[];
  actualContributions: PADTransitionContribution[];
  emotionStateBefore?: RuntimeEmotionState | null;
  emotionStateAfter?: RuntimeEmotionState | null;
};

type CoEInput = {
  emotionBefore: PADState;
  emotionAfter: PADState;
  appraisal: AppraisalVector;
  intentReason?: string | null;
  intentDelta?: PADState | null;
  stance?: string | null;
  primaryActs?: string[];
  emotionBeforeState?: RuntimeEmotionState | null;
  emotionAfterState?: RuntimeEmotionState | null;
  contributions?: PADTransitionContribution[];
};

const DRIVER_COUNT = 3;
const AXIS_DRIVER_COUNT = 2;
/**
 * Build an explainable CoE (Chain of Emotion) summary for designer-facing UI.
 */
export function buildCoEExplanation(input: CoEInput): CoEExplanation {
  const {
    emotionBefore,
    emotionAfter,
    appraisal,
    intentReason = null,
    intentDelta = null,
    stance = null,
    primaryActs = [],
    emotionBeforeState = null,
    emotionAfterState = null,
    contributions = [],
  } = input;
  const delta: PADState = {
    pleasure: emotionAfter.pleasure - emotionBefore.pleasure,
    arousal: emotionAfter.arousal - emotionBefore.arousal,
    dominance: emotionAfter.dominance - emotionBefore.dominance,
  };

  const byAxis: Record<AxisKey, CoEDriver[]> = {
    pleasure: [],
    arousal: [],
    dominance: [],
  };

  for (const contribution of getPADContributions(appraisal)) {
    byAxis[contribution.axis].push(
      createDriver(
        contribution.axis,
        contribution.factorKey,
        contribution.factorValue,
        contribution.contribution
      )
    );
  }

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

  const beforeEmotion = getPADEmotionLabel(emotionBefore);
  const afterEmotion = getPADEmotionLabel(emotionAfter);
  const movementNarrative = buildMovementNarrative(appraisal, contributions);
  const policySummary = buildPolicySummary(intentReason, intentDelta, stance, primaryActs);

  return {
    summary: buildSummary(delta, topDrivers, contributions, intentReason),
    delta,
    intentReason,
    policySummary,
    intentDelta,
    beforeEmotionLabel: beforeEmotion.label,
    afterEmotionLabel: afterEmotion.label,
    beforeEmotionDescription: beforeEmotion.description,
    afterEmotionDescription: afterEmotion.description,
    movementNarrative,
    topDrivers,
    axisSummaries,
    actualContributions: contributions,
    emotionStateBefore: emotionBeforeState,
    emotionStateAfter: emotionAfterState,
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

function buildSummary(
  delta: PADState,
  topDrivers: CoEDriver[],
  contributions: PADTransitionContribution[],
  _intentReason: string | null
): string {
  const deltaSummary = `快${formatSigned(delta.pleasure)} / 覚醒${formatSigned(delta.arousal)} / 支配感${formatSigned(delta.dominance)}`;

  const hasMeaningfulChange =
    Math.abs(delta.pleasure) >= PAD_DELTA_NOTICE_THRESHOLD ||
    Math.abs(delta.arousal) >= PAD_DELTA_NOTICE_THRESHOLD ||
    Math.abs(delta.dominance) >= PAD_DELTA_NOTICE_THRESHOLD;

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

  const transitionText =
    contributions.length > 0
      ? `遷移要因: ${contributions
          .slice()
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 2)
          .map((contribution) => `${translateContributionSource(contribution.source)}(${contribution.axis})${formatSigned(contribution.delta)}`)
          .join('、')}。`
      : '';

  return [lead, driverText, transitionText].filter(Boolean).join(' ');
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function buildMovementNarrative(
  appraisal: AppraisalVector,
  contributions: PADTransitionContribution[]
): string[] {
  const actual = contributions
    .filter((contribution) => Math.abs(contribution.delta) >= PAD_DELTA_NOTICE_THRESHOLD)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2)
    .map((contribution) => {
      const direction = contribution.delta > 0 ? '押し上げた' : '引き下げた';
      return `${translateContributionSource(contribution.source)}が${AXIS_LABELS[contribution.axis]}を${direction}。`;
    });

  if (actual.length > 0) {
    return actual;
  }

  const candidates = [
    {
      score: Math.abs(appraisal.goalCongruence),
      text:
        appraisal.goalCongruence >= 0.2
          ? '相手の言葉を、この関係にとって前向きな流れとして受け取っている。'
          : appraisal.goalCongruence <= -0.2
            ? '相手の言葉を、望ましくない流れとして受け取っている。'
            : null,
    },
    {
      score: Math.abs(appraisal.reciprocity),
      text:
        appraisal.reciprocity >= 0.2
          ? 'やり取りが一方通行ではなく、ちゃんと返ってきていると感じている。'
          : appraisal.reciprocity <= -0.2
            ? 'やり取りの釣り合いが悪く、一方的だと感じている。'
            : null,
    },
    {
      score: Math.abs(appraisal.normAlignment),
      text:
        appraisal.normAlignment >= 0.2
          ? '今の距離感や話題は、この関係の作法から大きく外れていない。'
          : appraisal.normAlignment <= -0.2
            ? '今の距離感や話題は、この関係には踏み込みすぎだと感じている。'
            : null,
    },
    {
      score: Math.abs(appraisal.controllability - 0.5),
      text:
        appraisal.controllability >= 0.65
          ? '自分のペースや主導権はまだ保てると感じている。'
          : appraisal.controllability <= 0.35
            ? '自分のペースを崩されやすく、主導権を取りにくいと感じている。'
            : null,
    },
    {
      score: Math.abs(appraisal.certainty - 0.5),
      text:
        appraisal.certainty >= 0.65
          ? '状況は比較的読みやすく、出方を決めやすい。'
          : appraisal.certainty <= 0.35
            ? 'まだ状況が読み切れず、慎重さが必要だと感じている。'
            : null,
    },
    {
      score: Math.abs(appraisal.attachmentSecurity - 0.5),
      text:
        appraisal.attachmentSecurity >= 0.65
          ? 'この相手とのやり取りに、少し安心感を持てている。'
          : appraisal.attachmentSecurity <= 0.35
            ? 'この相手とのやり取りに、まだ十分な安心感は持てていない。'
            : null,
    },
    {
      score: appraisal.pressureIntrusiveness,
      text:
        appraisal.pressureIntrusiveness >= 0.25
          ? '押しつけられている感覚があり、距離を取りたい気持ちが動いている。'
          : null,
    },
    {
      score: Math.abs(appraisal.novelty - 0.5),
      text:
        appraisal.novelty >= 0.65
          ? '新鮮さが強く、意識が相手に向きやすくなっている。'
          : appraisal.novelty <= 0.35
            ? '想定内の流れで、感情は大きく跳ねにくい。'
            : null,
    },
    {
      score: Math.abs(appraisal.selfRelevance - 0.5),
      text:
        appraisal.selfRelevance >= 0.65
          ? '自分に関わる話として受け取り、感情が動きやすい。'
          : appraisal.selfRelevance <= 0.35
            ? '自分事としてはそこまで強く刺さっていない。'
            : null,
    },
  ];

  return candidates
    .filter((item): item is { score: number; text: string } => Boolean(item.text))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.text);
}

function translateContributionSource(source: PADTransitionContribution['source']): string {
  const map: Record<PADTransitionContribution['source'], string> = {
    appraisal: 'appraisal寄与',
    decay: 'baselineへの減衰',
    open_thread_bias: 'open threadバイアス',
    blend: 'fast/slowブレンド',
    clamp: 'clamp補正',
  };
  return map[source];
}

function buildPolicySummary(
  intentReason: string | null,
  intentDelta: PADState | null,
  stance: string | null,
  primaryActs: string[]
): string | null {
  if (intentReason && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(intentReason)) {
    return intentReason;
  }

  const toneParts: string[] = [];
  if (stance) {
    toneParts.push(translateStance(stance));
  }

  if (intentDelta) {
    if (intentDelta.pleasure >= 0.08) toneParts.push('親しみを少し強める');
    else if (intentDelta.pleasure <= -0.08) toneParts.push('好意を抑えて距離を取る');

    if (intentDelta.arousal >= 0.08) toneParts.push('反応の勢いを少し上げる');
    else if (intentDelta.arousal <= -0.08) toneParts.push('温度を落ち着かせる');

    if (intentDelta.dominance >= 0.08) toneParts.push('少し主導権を持つ');
    else if (intentDelta.dominance <= -0.08) toneParts.push('出方を慎重にする');
  }

  const actParts = primaryActs
    .slice(0, 2)
    .map(translateDialogueAct)
    .filter(Boolean);

  const body = [...toneParts, ...actParts];
  if (body.length === 0) {
    return null;
  }

  return `今回は${body.join('、')}方針で返す。`;
}

function translateStance(stance: string): string {
  const map: Record<string, string> = {
    warm: '柔らかく受け止める',
    playful: '少し遊び心を混ぜる',
    neutral: 'フラットに受け止める',
    guarded: '警戒を残したまま返す',
    distant: '距離を保って返す',
    hurt: '傷つきをにじませて返す',
    angry: '怒りを抑えつつ返す',
    conflicted: '迷いを残したまま返す',
    intimate: '親密さをにじませて返す',
  };
  return map[stance] ?? '自然に返す';
}

function translateDialogueAct(act: string): string {
  const map: Record<string, string> = {
    share_information: '自分の情報を少し返す',
    ask_question: '質問で会話を前に進める',
    answer_question: '聞かれたことに答える',
    clarify: '意図を確認する',
    express_affection: '好意をにじませる',
    express_concern: '気にかける姿勢を見せる',
    offer_support: '支える姿勢を見せる',
    request_support: '支えを求める',
    tease: '軽くからかう',
    flirt: '少し色気を出す',
    agree: '同意を示す',
    disagree: '意見の違いを出す',
    suggest: '提案する',
    recommend: 'おすすめを出す',
    refuse: 'はっきり断る',
    delay: '今すぐは決めない',
    repair: '関係の修復を試みる',
    apologize: '謝意を示す',
    forgive: '受け流して修復する',
    confront: '問題を正面から指摘する',
    set_boundary: '境界線を引く',
    acknowledge: 'まず受け止める',
    redirect: '話題をやわらかくずらす',
    continue_topic: '今の話題を続ける',
    change_topic: '話題を切り替える',
  };
  return map[act] ?? '';
}
