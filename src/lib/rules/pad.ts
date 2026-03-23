import { PADState, AppraisalVector, EmotionSpec } from '../schemas';

/**
 * PAD (Pleasure-Arousal-Dominance) state management.
 *
 * Two timescales:
 * - Fast affect: Strong turn-by-turn reactions
 * - Slow mood: Smoothed carry-over state
 */

export type PADInput = {
  currentPAD: PADState;
  appraisal: AppraisalVector;
  emotionSpec: EmotionSpec;
  hasOpenThreads: boolean;
  turnsSinceLastUpdate: number;
};

export type PADUpdate = {
  fastAffect: PADState;
  slowMood: PADState;
  combined: PADState;
};

export type PADContributionFactorKey = keyof AppraisalVector | 'uncertainty';

export type PADContribution = {
  axis: keyof PADState;
  factorKey: PADContributionFactorKey;
  factorValue: number;
  contribution: number;
};

export const PAD_DELTA_NOTICE_THRESHOLD = 0.05;

const APPRAISAL_MIDPOINT = 0.5;
const FAST_AFFECT_GAIN = 0.5;

/**
 * Update PAD state based on appraisal.
 */
export function updatePAD(input: PADInput): PADUpdate {
  const { currentPAD, appraisal, emotionSpec, hasOpenThreads, turnsSinceLastUpdate } = input;
  const baseline = emotionSpec.baselinePAD;

  // Calculate fast affect from appraisal
  const fastAffect = computeFastAffect(appraisal, baseline);

  // Calculate decay for slow mood
  const decayedMood = applyDecay(
    currentPAD,
    baseline,
    emotionSpec.recovery,
    turnsSinceLastUpdate
  );

  // Blend fast affect into slow mood
  const blendFactor = 0.3; // How much fast affect influences slow mood
  const slowMood: PADState = {
    pleasure: decayedMood.pleasure + (fastAffect.pleasure - baseline.pleasure) * blendFactor,
    arousal: decayedMood.arousal + (fastAffect.arousal - baseline.arousal) * blendFactor,
    dominance: decayedMood.dominance + (fastAffect.dominance - baseline.dominance) * blendFactor,
  };

  // Open threads bias recovery and baseline negatively
  if (hasOpenThreads) {
    slowMood.pleasure -= 0.05;
    slowMood.dominance -= 0.03;
  }

  // Clamp values
  const clampedSlowMood = clampPAD(slowMood);

  // Combined state for external use (weighted average)
  const combined: PADState = {
    pleasure: fastAffect.pleasure * 0.6 + clampedSlowMood.pleasure * 0.4,
    arousal: fastAffect.arousal * 0.6 + clampedSlowMood.arousal * 0.4,
    dominance: fastAffect.dominance * 0.6 + clampedSlowMood.dominance * 0.4,
  };

  return {
    fastAffect: clampPAD(fastAffect),
    slowMood: clampedSlowMood,
    combined: clampPAD(combined),
  };
}

/**
 * Compute fast affect from appraisal.
 */
function computeFastAffect(appraisal: AppraisalVector, baseline: PADState): PADState {
  const next: PADState = { ...baseline };

  for (const contribution of getPADContributions(appraisal)) {
    next[contribution.axis] += contribution.contribution;
  }

  return next;
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
 * Apply exponential decay toward baseline.
 */
function applyDecay(
  current: PADState,
  baseline: PADState,
  recovery: { pleasureHalfLifeTurns: number; arousalHalfLifeTurns: number; dominanceHalfLifeTurns: number },
  turns: number
): PADState {
  const decayToward = (current: number, target: number, halfLife: number, t: number): number => {
    const decayFactor = Math.pow(0.5, t / halfLife);
    return target + (current - target) * decayFactor;
  };

  return {
    pleasure: decayToward(current.pleasure, baseline.pleasure, recovery.pleasureHalfLifeTurns, turns),
    arousal: decayToward(current.arousal, baseline.arousal, recovery.arousalHalfLifeTurns, turns),
    dominance: decayToward(current.dominance, baseline.dominance, recovery.dominanceHalfLifeTurns, turns),
  };
}

/**
 * Clamp PAD values to valid range.
 */
function clampPAD(pad: PADState): PADState {
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
  const { pleasure, arousal, dominance } = pad;

  // Simplified octant model
  if (pleasure > 0.3) {
    if (arousal > 0.3) {
      return dominance > 0 ? 'exuberant' : 'dependent';
    } else {
      return dominance > 0 ? 'relaxed' : 'docile';
    }
  } else if (pleasure < -0.3) {
    if (arousal > 0.3) {
      return dominance > 0 ? 'hostile' : 'anxious';
    } else {
      return dominance > 0 ? 'disdainful' : 'bored';
    }
  } else {
    return 'neutral';
  }
}

/**
 * Compute emotion externalization weights.
 * These affect how the character expresses themselves.
 */
export function computeExternalization(
  pad: PADState,
  emotionSpec: EmotionSpec
): {
  warmthMod: number;
  tersenessMod: number;
  directnessMod: number;
  teasingMod: number;
} {
  const ext = emotionSpec.externalization;

  return {
    warmthMod: pad.pleasure * ext.warmthWeight,
    tersenessMod: -pad.pleasure * ext.tersenessWeight + pad.arousal * 0.2,
    directnessMod: pad.dominance * ext.directnessWeight,
    teasingMod: pad.pleasure * ext.teasingWeight * (1 - Math.abs(pad.arousal) * 0.5),
  };
}
