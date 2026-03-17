/**
 * Ranking weights for candidate scoring.
 *
 * These weights determine how different scoring dimensions contribute to
 * the final ranking of response candidates.
 */

export interface RankWeights {
  personaConsistency: number;
  phaseCompliance: number;
  memoryGrounding: number;
  emotionalCoherence: number;
  autonomy: number;
  refusalNaturalness: number;
  contradictionPenalty: number;
}

/**
 * Default ranking weights.
 * Sum should equal 1.0 for proper normalization.
 */
export const DEFAULT_RANK_WEIGHTS: RankWeights = {
  personaConsistency: 0.20,
  phaseCompliance: 0.20,
  memoryGrounding: 0.15,
  emotionalCoherence: 0.15,
  autonomy: 0.10,
  refusalNaturalness: 0.10,
  contradictionPenalty: 0.10,
};

/**
 * Weights optimized for introduction phase.
 * More emphasis on persona and phase compliance, less on memory.
 */
export const INTRODUCTION_WEIGHTS: RankWeights = {
  personaConsistency: 0.25,
  phaseCompliance: 0.25,
  memoryGrounding: 0.10,
  emotionalCoherence: 0.15,
  autonomy: 0.10,
  refusalNaturalness: 0.10,
  contradictionPenalty: 0.05,
};

/**
 * Weights optimized for deepening phase.
 * More emphasis on memory and emotional coherence.
 */
export const DEEPENING_WEIGHTS: RankWeights = {
  personaConsistency: 0.18,
  phaseCompliance: 0.15,
  memoryGrounding: 0.20,
  emotionalCoherence: 0.17,
  autonomy: 0.12,
  refusalNaturalness: 0.08,
  contradictionPenalty: 0.10,
};

/**
 * Weights optimized for committed phase.
 * Memory and contradiction become more important.
 */
export const COMMITTED_WEIGHTS: RankWeights = {
  personaConsistency: 0.15,
  phaseCompliance: 0.12,
  memoryGrounding: 0.22,
  emotionalCoherence: 0.18,
  autonomy: 0.10,
  refusalNaturalness: 0.08,
  contradictionPenalty: 0.15,
};

/**
 * Weights optimized for intimacy phase.
 * Autonomy and refusal naturalness become crucial.
 */
export const INTIMACY_WEIGHTS: RankWeights = {
  personaConsistency: 0.15,
  phaseCompliance: 0.15,
  memoryGrounding: 0.15,
  emotionalCoherence: 0.15,
  autonomy: 0.15,
  refusalNaturalness: 0.15,
  contradictionPenalty: 0.10,
};

/**
 * Get appropriate weights for a given phase.
 */
export function getWeightsForPhase(phaseType: string): RankWeights {
  switch (phaseType.toLowerCase()) {
    case 'introduction':
    case 'intro':
      return INTRODUCTION_WEIGHTS;
    case 'deepening':
    case 'growing':
      return DEEPENING_WEIGHTS;
    case 'committed':
    case 'established':
      return COMMITTED_WEIGHTS;
    case 'intimacy':
    case 'intimate':
      return INTIMACY_WEIGHTS;
    default:
      return DEFAULT_RANK_WEIGHTS;
  }
}

/**
 * Calculate weighted score from individual scores.
 */
export function calculateWeightedScore(
  scores: Record<string, number>,
  weights: RankWeights = DEFAULT_RANK_WEIGHTS
): number {
  return (
    (scores.personaConsistency ?? 0) * weights.personaConsistency +
    (scores.phaseCompliance ?? 0) * weights.phaseCompliance +
    (scores.memoryGrounding ?? 0) * weights.memoryGrounding +
    (scores.emotionalCoherence ?? 0) * weights.emotionalCoherence +
    (scores.autonomy ?? 0) * weights.autonomy +
    (scores.refusalNaturalness ?? 0) * weights.refusalNaturalness +
    (scores.contradictionPenalty ?? 0) * weights.contradictionPenalty
  );
}

/**
 * Apply hard rejection thresholds.
 * Returns true if the candidate should be rejected.
 */
export function shouldHardReject(
  scores: Record<string, number>,
  thresholds: Partial<Record<keyof RankWeights, number>> = {}
): { reject: boolean; reason?: string } {
  const defaultThresholds = {
    phaseCompliance: 0.3,
    contradictionPenalty: 0.2,
    personaConsistency: 0.3,
  };

  const mergedThresholds = { ...defaultThresholds, ...thresholds };

  if ((scores.phaseCompliance ?? 1) < mergedThresholds.phaseCompliance) {
    return { reject: true, reason: 'Phase compliance too low' };
  }

  if ((scores.contradictionPenalty ?? 1) < mergedThresholds.contradictionPenalty) {
    return { reject: true, reason: 'Contradiction penalty too high' };
  }

  if ((scores.personaConsistency ?? 1) < mergedThresholds.personaConsistency) {
    return { reject: true, reason: 'Persona consistency too low' };
  }

  return { reject: false };
}

/**
 * Normalize weights to sum to 1.0.
 */
export function normalizeWeights(weights: RankWeights): RankWeights {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;

  return {
    personaConsistency: weights.personaConsistency / sum,
    phaseCompliance: weights.phaseCompliance / sum,
    memoryGrounding: weights.memoryGrounding / sum,
    emotionalCoherence: weights.emotionalCoherence / sum,
    autonomy: weights.autonomy / sum,
    refusalNaturalness: weights.refusalNaturalness / sum,
    contradictionPenalty: weights.contradictionPenalty / sum,
  };
}
