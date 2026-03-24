export function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeLegacyStyle(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const style = value as Record<string, unknown>;

  return {
    ...style,
    language: style.language === 'en' ? 'ja' : style.language,
    politenessDefault:
      style.politenessDefault === 'formal' ? 'polite' : style.politenessDefault,
  };
}

export function normalizeLegacyAutonomy(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const autonomy = value as Record<string, unknown>;

  return {
    ...autonomy,
    disagreeReadiness:
      autonomy.disagreeReadiness ?? autonomy.disagreementReadiness,
    conflictCarryover: autonomy.conflictCarryover ?? autonomy.conflictSustain,
    intimacyNeverOnDemand:
      autonomy.intimacyNeverOnDemand ?? autonomy.intimacyNotOnDemand,
  };
}

export function normalizeLegacyEmotion(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const emotion = value as Record<string, unknown>;

  const baselineRaw =
    (emotion.baselinePAD as Record<string, unknown> | undefined) ??
    (emotion.baseline as Record<string, unknown> | undefined) ??
    {};
  const recoveryRaw =
    (emotion.recovery as Record<string, unknown> | undefined) ?? {};
  const appraisalRaw =
    (emotion.appraisalSensitivity as Record<string, unknown> | undefined) ?? {};
  const externalizationRaw =
    (emotion.externalization as Record<string, unknown> | undefined) ?? {};

  return {
    ...emotion,
    baselinePAD: {
      pleasure: asNumber(baselineRaw.pleasure, 0),
      arousal: asNumber(baselineRaw.arousal, 0),
      dominance: asNumber(baselineRaw.dominance, 0),
    },
    recovery: {
      pleasureHalfLifeTurns: asNumber(recoveryRaw.pleasureHalfLifeTurns, 5),
      arousalHalfLifeTurns: asNumber(recoveryRaw.arousalHalfLifeTurns, 3),
      dominanceHalfLifeTurns: asNumber(recoveryRaw.dominanceHalfLifeTurns, 4),
    },
    appraisalSensitivity: {
      goalCongruence: asNumber(appraisalRaw.goalCongruence, 0.6),
      controllability: asNumber(appraisalRaw.controllability, 0.5),
      certainty: asNumber(appraisalRaw.certainty, 0.5),
      normAlignment: asNumber(appraisalRaw.normAlignment, 0.6),
      attachmentSecurity: asNumber(appraisalRaw.attachmentSecurity, 0.7),
      reciprocity: asNumber(appraisalRaw.reciprocity, 0.7),
      pressureIntrusiveness: asNumber(appraisalRaw.pressureIntrusiveness, 0.6),
      novelty: asNumber(appraisalRaw.novelty, 0.5),
      selfRelevance: asNumber(appraisalRaw.selfRelevance, 0.5),
    },
    externalization: {
      warmthWeight: asNumber(externalizationRaw.warmthWeight, 0.8),
      tersenessWeight: asNumber(externalizationRaw.tersenessWeight, 0.3),
      directnessWeight: asNumber(externalizationRaw.directnessWeight, 0.5),
      teasingWeight: asNumber(externalizationRaw.teasingWeight, 0.6),
    },
  };
}
