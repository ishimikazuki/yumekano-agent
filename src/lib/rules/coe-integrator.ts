import type {
  CoEIntegratorConfig,
  EmotionSpec,
  ExtractedInteractionAct,
  OpenThread,
  PADState,
  PADTransitionContribution,
  PairMetricDelta,
  PhaseNode,
  RelationshipMetrics,
  RelationalAppraisal,
  RuntimeEmotionState,
} from '../schemas';

const PAD_AXES = ['pleasure', 'arousal', 'dominance'] as const;
const PAIR_METRICS = ['trust', 'affinity', 'conflict', 'intimacyReadiness'] as const;
const RELATIONAL_AXES = [
  'warmthSignal',
  'reciprocitySignal',
  'safetySignal',
  'boundaryRespect',
  'pressureSignal',
  'repairSignal',
  'intimacySignal',
] as const;

type PadAxis = (typeof PAD_AXES)[number];
type PairMetricKey = (typeof PAIR_METRICS)[number];
type RelationalAxis = (typeof RELATIONAL_AXES)[number];
type IntegratorPhaseContext = Pick<PhaseNode, 'mode' | 'adultIntimacyEligibility'>;
type GuardrailKey = keyof CoEIntegratorConfig['guardrails'];
type IntegratorModifier = CoEIntegratorConfig['phaseModifiers']['entry'];

export type CoEIntegratorInput = {
  currentEmotion: RuntimeEmotionState;
  currentMetrics: RelationshipMetrics;
  appraisal: RelationalAppraisal;
  emotionSpec: EmotionSpec;
  currentPhase: IntegratorPhaseContext;
  openThreads: OpenThread[];
  turnsSinceLastUpdate: number;
  interactionActs?: ExtractedInteractionAct[];
  now?: Date;
};

export type CoEIntegratorResult = {
  before: RuntimeEmotionState;
  after: RuntimeEmotionState;
  relationshipBefore: RelationshipMetrics;
  relationshipAfter: RelationshipMetrics;
  padDelta: PADState;
  pairDelta: PairMetricDelta;
  contributions: PADTransitionContribution[];
  quietTurn: boolean;
  appraisalStrength: number;
  appliedGuardrails: GuardrailKey[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function clampPADValue(value: number): number {
  return clamp(round(value), -1, 1);
}

function clampPAD(pad: PADState): PADState {
  return {
    pleasure: clampPADValue(pad.pleasure),
    arousal: clampPADValue(pad.arousal),
    dominance: clampPADValue(pad.dominance),
  };
}

function clampMetric(value: number): number {
  return clamp(Number(value.toFixed(2)), 0, 100);
}

function decayValue(current: number, baseline: number, halfLifeTurns: number, turns: number): number {
  const retention = Math.pow(0.5, turns / halfLifeTurns);
  return baseline + (current - baseline) * retention;
}

function decayPadState(
  current: PADState,
  baseline: PADState,
  recovery: EmotionSpec['recovery'],
  turns: number
): PADState {
  return {
    pleasure: decayValue(current.pleasure, baseline.pleasure, recovery.pleasureHalfLifeTurns, turns),
    arousal: decayValue(current.arousal, baseline.arousal, recovery.arousalHalfLifeTurns, turns),
    dominance: decayValue(
      current.dominance,
      baseline.dominance,
      recovery.dominanceHalfLifeTurns,
      turns
    ),
  };
}

function combineEmotion(
  fastAffect: PADState,
  slowMood: PADState,
  fastRatio: number
): PADState {
  return {
    pleasure: fastAffect.pleasure * fastRatio + slowMood.pleasure * (1 - fastRatio),
    arousal: fastAffect.arousal * fastRatio + slowMood.arousal * (1 - fastRatio),
    dominance: fastAffect.dominance * fastRatio + slowMood.dominance * (1 - fastRatio),
  };
}

function positive(value: number): number {
  return Math.max(0, value);
}

function negative(value: number): number {
  return Math.max(0, -value);
}

function toRelationalSignals(
  appraisal: RelationalAppraisal
): Record<RelationalAxis, number> {
  const warmthSignal = clamp(
    appraisal.warmthImpact - positive(appraisal.rejectionImpact) * 0.6 + negative(appraisal.rejectionImpact) * 0.3,
    -1,
    1
  );
  const reciprocitySignal = clamp(
    appraisal.reciprocityImpact + appraisal.repairImpact * 0.2,
    -1,
    1
  );
  const safetySignal = clamp(
    appraisal.respectImpact +
      appraisal.boundarySignal * 0.4 -
      positive(appraisal.threatImpact) * 0.8 -
      positive(appraisal.pressureImpact) * 0.3 +
      appraisal.repairImpact * 0.15 +
      negative(appraisal.threatImpact) * 0.3 +
      negative(appraisal.pressureImpact) * 0.2,
    -1,
    1
  );
  const boundaryRespect = clamp(
    (appraisal.respectImpact + appraisal.boundarySignal) * 0.5 -
      positive(appraisal.threatImpact) * 0.25 +
      appraisal.repairImpact * 0.1 +
      negative(appraisal.threatImpact) * 0.15,
    -1,
    1
  );

  return {
    warmthSignal,
    reciprocitySignal,
    safetySignal,
    boundaryRespect,
    pressureSignal: clamp(
      positive(appraisal.pressureImpact) +
        positive(appraisal.threatImpact) * 0.5 +
        negative(appraisal.boundarySignal) * 0.35 +
        positive(appraisal.rejectionImpact) * 0.25,
      0,
      1
    ),
    repairSignal: clamp(
      appraisal.repairImpact - positive(appraisal.rejectionImpact) * 0.25,
      -1,
      1
    ),
    intimacySignal: clamp(
      appraisal.intimacySignal -
        positive(appraisal.threatImpact) * 0.15 -
        positive(appraisal.pressureImpact) * 0.1,
      -1,
      1
    ),
  };
}

function weightedAxisSum(
  weights: Record<RelationalAxis, number>,
  signals: Record<RelationalAxis, number>
): number {
  return RELATIONAL_AXES.reduce((sum, axis) => sum + weights[axis] * signals[axis], 0);
}

function pushAxisDeltas(
  contributions: PADTransitionContribution[],
  source: PADTransitionContribution['source'],
  before: PADState,
  after: PADState,
  reason: string
): void {
  for (const axis of PAD_AXES) {
    const delta = round(after[axis] - before[axis]);
    if (delta === 0) {
      continue;
    }

    contributions.push({
      source,
      axis,
      delta,
      reason,
    });
  }
}

function pushPadModifierContribution(
  contributions: PADTransitionContribution[],
  modifier: IntegratorModifier,
  reason: string
): void {
  for (const axis of PAD_AXES) {
    const delta = round(modifier[axis]);
    if (delta === 0) {
      continue;
    }

    contributions.push({
      source: 'appraisal',
      axis,
      delta,
      reason,
    });
  }
}

function getActIntensity(
  interactionActs: ExtractedInteractionAct[],
  act: ExtractedInteractionAct['act']
): number {
  return interactionActs.reduce((highest, entry) => {
    if (entry.act !== act) {
      return highest;
    }
    return Math.max(highest, entry.intensity * entry.confidence);
  }, 0);
}

function getAppraisalStrength(appraisal: RelationalAppraisal): number {
  return Math.max(
    Math.abs(appraisal.warmthImpact),
    Math.abs(appraisal.rejectionImpact),
    Math.abs(appraisal.respectImpact),
    Math.abs(appraisal.threatImpact),
    Math.abs(appraisal.pressureImpact),
    Math.abs(appraisal.repairImpact),
    Math.abs(appraisal.reciprocityImpact),
    Math.abs(appraisal.intimacySignal)
  );
}

function getOpenThreadSeverity(openThreads: OpenThread[]): number {
  return openThreads.reduce((sum, thread) => sum + thread.severity, 0);
}

function getEligibilityModifier(
  config: CoEIntegratorConfig,
  currentPhase: IntegratorPhaseContext
): IntegratorModifier {
  return config.eligibilityModifiers[currentPhase.adultIntimacyEligibility ?? 'conditional'];
}

function getGuardrails(input: {
  appraisal: RelationalAppraisal;
  currentMetrics: RelationshipMetrics;
  currentEmotion: RuntimeEmotionState;
  currentPhase: IntegratorPhaseContext;
  openThreads: OpenThread[];
  interactionActs: ExtractedInteractionAct[];
}): GuardrailKey[] {
  const { appraisal, currentMetrics, currentEmotion, currentPhase, openThreads, interactionActs } =
    input;
  const guardrails = new Set<GuardrailKey>();

  const insultIntensity = getActIntensity(interactionActs, 'insult');
  const apologyIntensity = Math.max(
    getActIntensity(interactionActs, 'apology'),
    getActIntensity(interactionActs, 'repair')
  );
  const pressureIntensity = Math.max(
    getActIntensity(interactionActs, 'pressure'),
    getActIntensity(interactionActs, 'boundary_test')
  );
  const intimacyIntensity = Math.max(
    getActIntensity(interactionActs, 'intimacy_bid'),
    getActIntensity(interactionActs, 'affection')
  );

  if (
    insultIntensity >= 0.3 ||
    appraisal.warmthImpact <= -0.55 ||
    appraisal.respectImpact <= -0.55 ||
    (appraisal.threatImpact >= 0.35 && appraisal.pressureImpact >= 0.2)
  ) {
    guardrails.add('insultShock');
  }

  if (
    apologyIntensity >= 0.25 ||
    (appraisal.repairImpact >= 0.4 &&
      appraisal.pressureImpact <= 0.25 &&
      appraisal.warmthImpact >= -0.1)
  ) {
    guardrails.add('apologyRepair');
  }

  if (
    pressureIntensity >= 0.35 ||
    (appraisal.pressureImpact >= 0.45 &&
      (currentMetrics.conflict >= 12 ||
        openThreads.length > 0 ||
        currentEmotion.slowMood.arousal >= 0.15))
  ) {
    guardrails.add('sustainedPressure');
  }

  if (
    (intimacyIntensity >= 0.35 || appraisal.intimacySignal >= 0.35) &&
    (currentPhase.adultIntimacyEligibility === 'never' ||
      appraisal.boundarySignal <= -0.3 ||
      appraisal.pressureImpact >= 0.4 ||
      pressureIntensity >= 0.35)
  ) {
    guardrails.add('consentBoundary');
  }

  return [...guardrails];
}

function applyMetricInertia(
  current: number,
  rawDelta: number,
  resistance: number
): number {
  if (rawDelta === 0) {
    return current;
  }

  const room =
    rawDelta >= 0
      ? clamp((100 - current) / 100, 0.05, 1)
      : clamp(current / 100, 0.05, 1);
  const scaledDelta = rawDelta * Math.pow(room, Math.max(0.1, resistance * 0.35));
  return clampMetric(current + scaledDelta);
}

function relaxMetricTowardBaseline(
  current: number,
  baseline: number,
  rate: number,
  turns: number
): number {
  const ratio = 1 - Math.pow(1 - rate, turns);
  return current + (baseline - current) * ratio;
}

export function integrateCoEAppraisal(input: CoEIntegratorInput): CoEIntegratorResult {
  const {
    currentEmotion,
    currentMetrics,
    appraisal,
    emotionSpec,
    currentPhase,
    openThreads,
    interactionActs = [],
    now,
  } = input;
  const resolvedNow = now ?? currentEmotion.lastUpdatedAt;

  const elapsedTurns = Math.max(1, input.turnsSinceLastUpdate);
  const config = emotionSpec.coeIntegrator;
  const baseline = emotionSpec.baselinePAD;
  const signals = toRelationalSignals(appraisal);
  const phaseModifier = config.phaseModifiers[currentPhase.mode];
  const eligibilityModifier = getEligibilityModifier(config, currentPhase);
  const guardrails = getGuardrails({
    appraisal,
    currentMetrics,
    currentEmotion,
    currentPhase,
    openThreads,
    interactionActs,
  });
  const contributions: PADTransitionContribution[] = [];
  const appraisalStrength = getAppraisalStrength(appraisal);
  const quietTurn = appraisalStrength < config.relationship.quietTurnThreshold;
  const openThreadSeverity = getOpenThreadSeverity(openThreads);

  const decayedFast = clampPAD(
    decayPadState(currentEmotion.fastAffect, baseline, emotionSpec.recovery, elapsedTurns)
  );
  const decayedSlow = clampPAD(
    decayPadState(currentEmotion.slowMood, baseline, emotionSpec.recovery, elapsedTurns)
  );
  const combinedAfterDecay = clampPAD(
    combineEmotion(decayedFast, decayedSlow, config.impulse.combinedFastRatio)
  );
  pushAxisDeltas(
    contributions,
    'decay',
    currentEmotion.combined,
    combinedAfterDecay,
    'baseline recovery and emotional inertia'
  );

  const padBaseDelta: PADState = {
    pleasure:
      weightedAxisSum(config.padWeights.pleasure, signals) *
      phaseModifier.pleasure *
      eligibilityModifier.pleasure *
      config.impulse.fastAffectBlend,
    arousal:
      weightedAxisSum(config.padWeights.arousal, signals) *
      phaseModifier.arousal *
      eligibilityModifier.arousal *
      config.impulse.fastAffectBlend,
    dominance:
      weightedAxisSum(config.padWeights.dominance, signals) *
      phaseModifier.dominance *
      eligibilityModifier.dominance *
      config.impulse.fastAffectBlend,
  };

  const guardrailModifier = guardrails.reduce<IntegratorModifier>(
    (combined, key) => {
      const modifier = config.guardrails[key];
      return {
        pleasure: combined.pleasure + modifier.pleasure,
        arousal: combined.arousal + modifier.arousal,
        dominance: combined.dominance + modifier.dominance,
        trust: combined.trust + modifier.trust,
        affinity: combined.affinity + modifier.affinity,
        conflict: combined.conflict + modifier.conflict,
        intimacyReadiness: combined.intimacyReadiness + modifier.intimacyReadiness,
      };
    },
    {
      pleasure: 0,
      arousal: 0,
      dominance: 0,
      trust: 0,
      affinity: 0,
      conflict: 0,
      intimacyReadiness: 0,
    }
  );

  const fastAfterImpulse = clampPAD({
    pleasure: decayedFast.pleasure + padBaseDelta.pleasure + guardrailModifier.pleasure,
    arousal: decayedFast.arousal + padBaseDelta.arousal + guardrailModifier.arousal,
    dominance: decayedFast.dominance + padBaseDelta.dominance + guardrailModifier.dominance,
  });
  const combinedAfterImpulse = clampPAD(
    combineEmotion(fastAfterImpulse, decayedSlow, config.impulse.combinedFastRatio)
  );
  pushAxisDeltas(
    contributions,
    'appraisal',
    combinedAfterDecay,
    combinedAfterImpulse,
    'CoE appraisal impulse'
  );
  if (guardrails.length > 0) {
    pushPadModifierContribution(
      contributions,
      guardrailModifier,
      `guardrail override: ${guardrails.join(', ')}`
    );
  }

  const slowWithThreadBias = clampPAD({
    pleasure:
      decayedSlow.pleasure +
      config.openThreadBias.pleasurePerThreadSeverity * openThreadSeverity,
    arousal: decayedSlow.arousal,
    dominance:
      decayedSlow.dominance +
      config.openThreadBias.dominancePerThreadSeverity * openThreadSeverity,
  });
  const combinedAfterThreadBias = clampPAD(
    combineEmotion(fastAfterImpulse, slowWithThreadBias, config.impulse.combinedFastRatio)
  );
  pushAxisDeltas(
    contributions,
    'open_thread_bias',
    combinedAfterImpulse,
    combinedAfterThreadBias,
    'open threads keep tension active'
  );

  const slowAfterBlend = clampPAD({
    pleasure:
      slowWithThreadBias.pleasure +
      (fastAfterImpulse.pleasure - baseline.pleasure) * config.impulse.slowMoodBlend,
    arousal:
      slowWithThreadBias.arousal +
      (fastAfterImpulse.arousal - baseline.arousal) * config.impulse.slowMoodBlend,
    dominance:
      slowWithThreadBias.dominance +
      (fastAfterImpulse.dominance - baseline.dominance) * config.impulse.slowMoodBlend,
  });
  const combinedRaw = combineEmotion(
    fastAfterImpulse,
    slowAfterBlend,
    config.impulse.combinedFastRatio
  );
  const combinedAfterBlend = clampPAD(combinedRaw);
  pushAxisDeltas(
    contributions,
    'blend',
    combinedAfterThreadBias,
    combinedAfterBlend,
    'fast affect carried into slow mood'
  );
  pushAxisDeltas(
    contributions,
    'clamp',
    combinedRaw,
    combinedAfterBlend,
    'combined PAD clamped to allowed range'
  );

  const pairRawDelta: PairMetricDelta = {
    trust:
      weightedAxisSum(config.pairWeights.trust, signals) *
        phaseModifier.trust *
        eligibilityModifier.trust +
      guardrailModifier.trust +
      config.openThreadBias.trustPerThreadSeverity * openThreadSeverity,
    affinity:
      weightedAxisSum(config.pairWeights.affinity, signals) *
        phaseModifier.affinity *
        eligibilityModifier.affinity +
      guardrailModifier.affinity +
      config.openThreadBias.affinityPerThreadSeverity * openThreadSeverity,
    conflict:
      weightedAxisSum(config.pairWeights.conflict, signals) *
        phaseModifier.conflict *
        eligibilityModifier.conflict +
      guardrailModifier.conflict +
      config.openThreadBias.conflictPerThreadSeverity * openThreadSeverity,
    intimacyReadiness:
      weightedAxisSum(config.pairWeights.intimacyReadiness, signals) *
        phaseModifier.intimacyReadiness *
        eligibilityModifier.intimacyReadiness +
      guardrailModifier.intimacyReadiness +
      config.openThreadBias.intimacyPerThreadSeverity * openThreadSeverity,
  };

  const relationshipAfterImpulse: RelationshipMetrics = {
    trust: applyMetricInertia(
      currentMetrics.trust,
      pairRawDelta.trust,
      config.relationship.edgeResistance.trust
    ),
    affinity: applyMetricInertia(
      currentMetrics.affinity,
      pairRawDelta.affinity,
      config.relationship.edgeResistance.affinity
    ),
    conflict: applyMetricInertia(
      currentMetrics.conflict,
      pairRawDelta.conflict,
      config.relationship.edgeResistance.conflict
    ),
    intimacyReadiness: applyMetricInertia(
      currentMetrics.intimacyReadiness,
      pairRawDelta.intimacyReadiness,
      config.relationship.edgeResistance.intimacyReadiness
    ),
  };

  const relationshipAfter = quietTurn
    ? {
        trust: clampMetric(
          relaxMetricTowardBaseline(
            relationshipAfterImpulse.trust,
            config.relationship.neutralBaseline.trust,
            config.relationship.quietDecay.trust,
            elapsedTurns
          )
        ),
        affinity: clampMetric(
          relaxMetricTowardBaseline(
            relationshipAfterImpulse.affinity,
            config.relationship.neutralBaseline.affinity,
            config.relationship.quietDecay.affinity,
            elapsedTurns
          )
        ),
        conflict: clampMetric(
          relaxMetricTowardBaseline(
            relationshipAfterImpulse.conflict,
            config.relationship.neutralBaseline.conflict,
            config.relationship.quietDecay.conflict,
            elapsedTurns
          )
        ),
        intimacyReadiness: clampMetric(
          relaxMetricTowardBaseline(
            relationshipAfterImpulse.intimacyReadiness,
            config.relationship.neutralBaseline.intimacyReadiness,
            config.relationship.quietDecay.intimacyReadiness,
            elapsedTurns
          )
        ),
      }
    : relationshipAfterImpulse;

  return {
    before: currentEmotion,
    after: {
      fastAffect: fastAfterImpulse,
      slowMood: slowAfterBlend,
      combined: combinedAfterBlend,
      lastUpdatedAt: resolvedNow,
    },
    relationshipBefore: currentMetrics,
    relationshipAfter,
    padDelta: {
      pleasure: round(combinedAfterBlend.pleasure - currentEmotion.combined.pleasure),
      arousal: round(combinedAfterBlend.arousal - currentEmotion.combined.arousal),
      dominance: round(combinedAfterBlend.dominance - currentEmotion.combined.dominance),
    },
    pairDelta: {
      trust: round(relationshipAfter.trust - currentMetrics.trust, 2),
      affinity: round(relationshipAfter.affinity - currentMetrics.affinity, 2),
      conflict: round(relationshipAfter.conflict - currentMetrics.conflict, 2),
      intimacyReadiness: round(
        relationshipAfter.intimacyReadiness - currentMetrics.intimacyReadiness,
        2
      ),
    },
    contributions,
    quietTurn,
    appraisalStrength: round(appraisalStrength),
    appliedGuardrails: guardrails,
  };
}
