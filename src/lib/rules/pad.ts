import {
  PADState,
  AppraisalVector,
  RuntimeEmotionState,
  PADTransitionContribution,
} from '../schemas';

/**
 * PAD (Pleasure-Arousal-Dominance) state management.
 *
 * Two timescales:
 * - Fast affect: Strong turn-by-turn reactions
 * - Slow mood: Smoothed carry-over state
 */

export type PADContributionFactorKey = keyof AppraisalVector | 'uncertainty';

export type PADContribution = {
  axis: keyof PADState;
  factorKey: PADContributionFactorKey;
  factorValue: number;
  contribution: number;
};

export type PADEmotionLabel = {
  key:
    | 'excited_confident'
    | 'excited_open'
    | 'warm_confident'
    | 'warm_gentle'
    | 'tense_defensive'
    | 'tense_anxious'
    | 'cold_resistant'
    | 'dejected'
    | 'alert'
    | 'calm'
    | 'composed';
  label: string;
  description: string;
};

export const PAD_DELTA_NOTICE_THRESHOLD = 0.05;

const APPRAISAL_MIDPOINT = 0.5;
const FAST_AFFECT_GAIN = 0.5;

export function createRuntimeEmotionState(
  combined: PADState,
  at: Date = new Date()
): RuntimeEmotionState {
  const clamped = clampPAD(combined);
  return {
    fastAffect: clamped,
    slowMood: clamped,
    combined: clamped,
    lastUpdatedAt: at,
  };
}

export function getPADContributions(appraisal: AppraisalVector): PADContribution[] {
  const centered = (value: number) => value - APPRAISAL_MIDPOINT;

  return [
    {
      axis: 'pleasure',
      factorKey: 'goalCongruence',
      factorValue: appraisal.goalCongruence,
      contribution: appraisal.goalCongruence * 0.4 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'pleasure',
      factorKey: 'reciprocity',
      factorValue: appraisal.reciprocity,
      contribution: appraisal.reciprocity * 0.2 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'pleasure',
      factorKey: 'attachmentSecurity',
      factorValue: appraisal.attachmentSecurity,
      contribution: centered(appraisal.attachmentSecurity) * 0.2 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'pleasure',
      factorKey: 'pressureIntrusiveness',
      factorValue: appraisal.pressureIntrusiveness,
      contribution: appraisal.pressureIntrusiveness * -0.3 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'pleasure',
      factorKey: 'normAlignment',
      factorValue: appraisal.normAlignment,
      contribution: appraisal.normAlignment * 0.15 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'arousal',
      factorKey: 'novelty',
      factorValue: appraisal.novelty,
      contribution: centered(appraisal.novelty) * 0.3 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'arousal',
      factorKey: 'selfRelevance',
      factorValue: appraisal.selfRelevance,
      contribution: centered(appraisal.selfRelevance) * 0.2 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'arousal',
      factorKey: 'pressureIntrusiveness',
      factorValue: appraisal.pressureIntrusiveness,
      contribution: appraisal.pressureIntrusiveness * 0.25 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'arousal',
      factorKey: 'uncertainty',
      factorValue: 1 - appraisal.certainty,
      contribution: (APPRAISAL_MIDPOINT - appraisal.certainty) * 0.15 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'dominance',
      factorKey: 'controllability',
      factorValue: appraisal.controllability,
      contribution: centered(appraisal.controllability) * 0.35 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'dominance',
      factorKey: 'certainty',
      factorValue: appraisal.certainty,
      contribution: centered(appraisal.certainty) * 0.15 * FAST_AFFECT_GAIN,
    },
    {
      axis: 'dominance',
      factorKey: 'pressureIntrusiveness',
      factorValue: appraisal.pressureIntrusiveness,
      contribution: appraisal.pressureIntrusiveness * -0.3 * FAST_AFFECT_GAIN,
    },
  ];
}

/**
 * Clamp PAD values to valid range.
 */
export function clampPAD(pad: PADState): PADState {
  return {
    pleasure: Math.max(-1, Math.min(1, pad.pleasure)),
    arousal: Math.max(-1, Math.min(1, pad.arousal)),
    dominance: Math.max(-1, Math.min(1, pad.dominance)),
  };
}

/**
 * Get emotional label from PAD state.
 * Useful for debugging and traces.
 */
export function getPADLabel(pad: PADState): string {
  return getPADEmotionLabel(pad).label;
}

export function getPADEmotionLabel(pad: PADState): PADEmotionLabel {
  const { pleasure, arousal, dominance } = pad;

  if (pleasure >= 0.35) {
    if (arousal >= 0.35) {
      if (dominance >= 0.15) {
        return {
          key: 'excited_confident',
          label: '自信のある高揚',
          description: '前向きで勢いがあり、自分から動ける気分。',
        };
      }
      return {
        key: 'excited_open',
        label: '前向きな高揚',
        description: '嬉しさと勢いがあり、相手に開きやすい気分。',
      };
    }

    if (arousal <= -0.1) {
      if (dominance >= 0.15) {
        return {
          key: 'warm_confident',
          label: '落ち着いた自信',
          description: '好意はありつつ、落ち着いて主導権を持てる気分。',
        };
      }
      return {
        key: 'warm_gentle',
        label: '穏やかな安心',
        description: '柔らかく安心していて、相手を受け入れやすい気分。',
      };
    }

    return dominance >= 0.15
      ? {
          key: 'warm_confident',
          label: '落ち着いた自信',
          description: '前向きさを保ちながら、自分のペースも守れている気分。',
        }
      : {
          key: 'warm_gentle',
          label: '穏やかな好意',
          description: '相手への好意があり、柔らかく関わりたい気分。',
        };
  }

  if (pleasure <= -0.25) {
    if (arousal >= 0.35) {
      if (dominance >= 0) {
        return {
          key: 'tense_defensive',
          label: 'いら立ちと警戒',
          description: '不快さがあり、身構えながら反発しやすい気分。',
        };
      }
      return {
        key: 'tense_anxious',
        label: '緊張と不安',
        description: '不快さがあり、落ち着かず防御的になりやすい気分。',
      };
    }

    if (arousal <= -0.1) {
      if (dominance >= 0) {
        return {
          key: 'cold_resistant',
          label: '冷えた反発',
          description: '感情を抑えつつ距離を取り、拒否に寄りやすい気分。',
        };
      }
      return {
        key: 'dejected',
        label: 'しょんぼり',
        description: '元気が落ちていて、引き気味になりやすい気分。',
      };
    }

    return dominance >= 0
      ? {
          key: 'cold_resistant',
          label: '身を固くした反発',
          description: '不快感を抱えつつ、距離と境界を守ろうとする気分。',
        }
      : {
          key: 'tense_anxious',
          label: '戸惑い混じりの不安',
          description: '嫌さと不安が混ざり、出方を慎重に見ている気分。',
        };
  }

  if (arousal >= 0.35) {
    return dominance >= 0.15
      ? {
          key: 'alert',
          label: '身構え',
          description: '大きな好悪はないが、意識が立っていて様子を見ている気分。',
        }
      : {
          key: 'alert',
          label: 'そわそわ',
          description: '気持ちは中立寄りだが、少し落ち着かず反応が立っている気分。',
        };
  }

  if (arousal <= -0.1) {
    return dominance >= 0.15
      ? {
          key: 'composed',
          label: '静かな主導',
          description: '落ち着いたまま自分のペースを保てている気分。',
        }
      : {
          key: 'calm',
          label: '平静',
          description: '大きく揺れておらず、落ち着いて受け止めている気分。',
        };
  }

  return dominance >= 0.15
    ? {
        key: 'composed',
        label: '落ち着いた構え',
        description: '感情は大きく揺れず、穏やかに主導権を持てている気分。',
      }
    : {
        key: 'calm',
        label: '平静',
        description: '感情の波は小さく、フラットに近い気分。',
      };
}

