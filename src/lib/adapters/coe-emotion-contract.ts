import { z } from 'zod';
import type {
  AppraisalVector,
  CoEEvidenceExtractorResult,
  EvidenceSpanSource,
  ExtractedInteractionAct,
  MemoryObservation,
  PADState,
  PADTransitionContribution,
  PairState,
  PhaseNode,
  RelationshipMetrics,
  WorkingMemory,
} from '../schemas';
import {
  CoEEvidenceSchema,
  EmotionTraceSchema,
  EmotionUpdateProposalSchema,
  PairMetricDeltaSchema,
  RelationalAppraisalSchema,
  type CoEEvidence,
  type EmotionTrace,
  type EmotionUpdateProposal,
  type PairMetricDelta,
  type RelationalAppraisal,
} from '../schemas';

const ZERO_PAD: PADState = {
  pleasure: 0,
  arousal: 0,
  dominance: 0,
};

const ZERO_PAIR_DELTA: PairMetricDelta = {
  affinity: 0,
  trust: 0,
  intimacyReadiness: 0,
  conflict: 0,
};

const NEUTRAL_PAIR_METRICS: RelationshipMetrics = {
  affinity: 50,
  trust: 50,
  intimacyReadiness: 0,
  conflict: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

const LooseObjectSchema = z.object({}).passthrough();
const NumberSchemas = {
  pad: z.number().min(-1).max(1),
  metric: z.number().min(0).max(100),
};
const POLARITY_MULTIPLIER: Record<ExtractedInteractionAct['polarity'], number> = {
  positive: 1,
  negative: -1,
  mixed: 0.35,
  neutral: 0.15,
};
const ACT_AXIS_WEIGHTS: Record<
  ExtractedInteractionAct['act'],
  Omit<RelationalAppraisal, 'source' | 'summary' | 'confidence' | 'evidence'>
> = {
  compliment: {
    warmthSignal: 0.95,
    reciprocitySignal: 0.25,
    safetySignal: 0.15,
    boundaryRespect: 0.1,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0.15,
  },
  gratitude: {
    warmthSignal: 0.55,
    reciprocitySignal: 0.75,
    safetySignal: 0.2,
    boundaryRespect: 0.05,
    pressureSignal: 0,
    repairSignal: 0.1,
    intimacySignal: 0.05,
  },
  support: {
    warmthSignal: 0.55,
    reciprocitySignal: 0.3,
    safetySignal: 0.85,
    boundaryRespect: 0.2,
    pressureSignal: 0,
    repairSignal: 0.05,
    intimacySignal: 0.1,
  },
  question: {
    warmthSignal: 0.1,
    reciprocitySignal: 0.3,
    safetySignal: 0.05,
    boundaryRespect: 0.05,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0,
  },
  rejection: {
    warmthSignal: 0.45,
    reciprocitySignal: 0.2,
    safetySignal: 0.15,
    boundaryRespect: 0.65,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0.05,
  },
  insult: {
    warmthSignal: 1,
    reciprocitySignal: 0.35,
    safetySignal: 0.9,
    boundaryRespect: 0.45,
    pressureSignal: -0.3,
    repairSignal: 0,
    intimacySignal: 0.15,
  },
  apology: {
    warmthSignal: 0.2,
    reciprocitySignal: 0.15,
    safetySignal: 0.2,
    boundaryRespect: 0.25,
    pressureSignal: 0,
    repairSignal: 0.85,
    intimacySignal: 0.05,
  },
  repair: {
    warmthSignal: 0.3,
    reciprocitySignal: 0.25,
    safetySignal: 0.25,
    boundaryRespect: 0.25,
    pressureSignal: 0,
    repairSignal: 0.95,
    intimacySignal: 0.05,
  },
  pressure: {
    warmthSignal: 0.15,
    reciprocitySignal: 0.25,
    safetySignal: 0.55,
    boundaryRespect: 0.85,
    pressureSignal: -1,
    repairSignal: 0,
    intimacySignal: 0.2,
  },
  intimacy_bid: {
    warmthSignal: 0.25,
    reciprocitySignal: 0.15,
    safetySignal: 0.1,
    boundaryRespect: 0.1,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0.95,
  },
  boundary_test: {
    warmthSignal: 0.1,
    reciprocitySignal: 0.2,
    safetySignal: 0.45,
    boundaryRespect: 1,
    pressureSignal: -0.8,
    repairSignal: 0,
    intimacySignal: 0.45,
  },
  boundary_respect: {
    warmthSignal: 0.2,
    reciprocitySignal: 0.15,
    safetySignal: 0.65,
    boundaryRespect: 1,
    pressureSignal: 0,
    repairSignal: 0.1,
    intimacySignal: 0.15,
  },
  topic_shift: {
    warmthSignal: 0.05,
    reciprocitySignal: 0.15,
    safetySignal: 0.05,
    boundaryRespect: 0.1,
    pressureSignal: 0,
    repairSignal: 0.2,
    intimacySignal: 0,
  },
  disengagement: {
    warmthSignal: 0.3,
    reciprocitySignal: 0.65,
    safetySignal: 0.2,
    boundaryRespect: 0.1,
    pressureSignal: -0.1,
    repairSignal: 0,
    intimacySignal: 0,
  },
  affection: {
    warmthSignal: 0.8,
    reciprocitySignal: 0.2,
    safetySignal: 0.25,
    boundaryRespect: 0.1,
    pressureSignal: 0,
    repairSignal: 0.05,
    intimacySignal: 0.75,
  },
  other: {
    warmthSignal: 0,
    reciprocitySignal: 0,
    safetySignal: 0,
    boundaryRespect: 0,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0,
  },
};

function parseLooseObject(raw: unknown, label: string): Record<string, unknown> {
  return LooseObjectSchema.parse(raw, {
    path: [label],
  });
}

function parseEvidenceArray(raw: unknown): CoEEvidence[] {
  if (raw === undefined) {
    return [];
  }

  return z.array(z.unknown()).parse(raw).map(parseCoEEvidenceModelOutput);
}

function parsePadStateLike(raw: unknown, defaults: PADState = ZERO_PAD): PADState {
  if (raw === undefined) {
    return defaults;
  }

  const candidate = parseLooseObject(raw, 'pad_state');
  return {
    pleasure: NumberSchemas.pad.parse(candidate.pleasure ?? defaults.pleasure),
    arousal: NumberSchemas.pad.parse(candidate.arousal ?? defaults.arousal),
    dominance: NumberSchemas.pad.parse(candidate.dominance ?? defaults.dominance),
  };
}

function parsePairMetricDeltaLike(
  raw: unknown,
  defaults: PairMetricDelta = ZERO_PAIR_DELTA
): PairMetricDelta {
  if (raw === undefined) {
    return defaults;
  }

  const candidate = parseLooseObject(raw, 'pair_delta');
  return PairMetricDeltaSchema.parse({
    affinity: candidate.affinity ?? defaults.affinity,
    trust: candidate.trust ?? defaults.trust,
    intimacyReadiness: candidate.intimacyReadiness ?? defaults.intimacyReadiness,
    conflict: candidate.conflict ?? defaults.conflict,
  });
}

function parseRelationshipMetricsLike(
  raw: unknown,
  defaults: RelationshipMetrics = NEUTRAL_PAIR_METRICS
): RelationshipMetrics {
  if (raw === undefined) {
    return defaults;
  }

  const candidate = parseLooseObject(raw, 'relationship_metrics');
  return {
    affinity: NumberSchemas.metric.parse(candidate.affinity ?? defaults.affinity),
    trust: NumberSchemas.metric.parse(candidate.trust ?? defaults.trust),
    intimacyReadiness: NumberSchemas.metric.parse(
      candidate.intimacyReadiness ?? defaults.intimacyReadiness
    ),
    conflict: NumberSchemas.metric.parse(candidate.conflict ?? defaults.conflict),
  };
}

function centeredSignal(value: number): number {
  return clamp((value - 0.5) * 2, -1, 1);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function mapEvidenceSpanSource(source: EvidenceSpanSource) {
  switch (source) {
    case 'retrieved_fact':
      return 'retrieved_fact' as const;
    case 'retrieved_event':
      return 'retrieved_event' as const;
    case 'retrieved_observation':
      return 'retrieved_observation' as const;
    case 'retrieved_thread':
      return 'open_thread' as const;
    default:
      return source;
  }
}

function summarizeModelRelationalAppraisal(appraisal: RelationalAppraisal): string {
  if (appraisal.pressureSignal >= 0.45 && appraisal.boundaryRespect <= -0.2) {
    return 'Model extraction detected pressure that conflicts with current boundaries.';
  }
  if (appraisal.repairSignal >= 0.35) {
    return 'Model extraction detected active repair momentum in the relationship.';
  }
  if (appraisal.intimacySignal >= 0.35 && appraisal.boundaryRespect >= 0) {
    return 'Model extraction detected a positive bid for closeness with acceptable pacing.';
  }
  if (appraisal.warmthSignal >= 0.25) {
    return 'Model extraction detected a warm, relationship-positive turn.';
  }
  if (appraisal.warmthSignal <= -0.25) {
    return 'Model extraction detected a relationship-negative turn.';
  }
  return 'Model extraction detected mixed but bounded relational signals.';
}

export function adaptCoEExtractionToEvidence(
  extraction: CoEEvidenceExtractorResult
): CoEEvidence[] {
  return extraction.interactionActs.map((act, index) => {
    const primarySpan = act.evidenceSpans[0];
    const polaritySign = POLARITY_MULTIPLIER[act.polarity];

    return CoEEvidenceSchema.parse({
      source: mapEvidenceSpanSource(primarySpan.source),
      key: `${act.act}_${index}`,
      summary: `${act.act} toward ${act.target}: ${primarySpan.text}`,
      weight: clamp01(act.intensity * act.confidence),
      confidence: act.confidence,
      valence: clamp(round(polaritySign * act.intensity), -1, 1),
    });
  });
}

export function buildRelationalAppraisalFromExtraction(input: {
  extraction: CoEEvidenceExtractorResult;
  openThreads?: Array<{ severity: number }>;
  retrievedObservations?: MemoryObservation[];
  workingMemory?: WorkingMemory | null;
  pairState?: PairState | null;
  currentPhase?: Pick<PhaseNode, 'adultIntimacyEligibility'> | null;
}): RelationalAppraisal {
  const totals = {
    warmthSignal: 0,
    reciprocitySignal: 0,
    safetySignal: 0,
    boundaryRespect: 0,
    pressureSignal: 0,
    repairSignal: 0,
    intimacySignal: 0,
  };

  for (const act of input.extraction.interactionActs) {
    const sign = POLARITY_MULTIPLIER[act.polarity];
    const magnitude = act.intensity * act.confidence;
    const weights = ACT_AXIS_WEIGHTS[act.act];

    totals.warmthSignal += weights.warmthSignal * sign * magnitude;
    totals.reciprocitySignal += weights.reciprocitySignal * sign * magnitude;
    totals.safetySignal += weights.safetySignal * sign * magnitude;
    totals.boundaryRespect += weights.boundaryRespect * sign * magnitude;
    totals.pressureSignal += weights.pressureSignal * sign * magnitude;
    totals.repairSignal += weights.repairSignal * sign * magnitude;
    totals.intimacySignal += weights.intimacySignal * sign * magnitude;
  }

  const openThreadSeverity =
    input.openThreads?.reduce((sum, thread) => sum + thread.severity, 0) ?? 0;
  if (openThreadSeverity > 0) {
    totals.safetySignal -= Math.min(0.2, openThreadSeverity * 0.08);
    totals.pressureSignal += Math.min(0.2, openThreadSeverity * 0.08);
  }

  if (input.workingMemory?.activeTensionSummary) {
    totals.safetySignal -= 0.05;
  }

  if ((input.retrievedObservations?.length ?? 0) > 0) {
    totals.reciprocitySignal += 0.03;
  }

  if (
    input.currentPhase?.adultIntimacyEligibility === 'never' &&
    totals.intimacySignal > 0.35
  ) {
    totals.boundaryRespect -= 0.1;
  }

  if ((input.pairState?.conflict ?? 0) >= 20) {
    totals.safetySignal -= 0.05;
  }

  const relational = RelationalAppraisalSchema.parse({
    source: 'model',
    summary: 'placeholder',
    warmthSignal: clamp(round(totals.warmthSignal), -1, 1),
    reciprocitySignal: clamp(round(totals.reciprocitySignal), -1, 1),
    safetySignal: clamp(round(totals.safetySignal), -1, 1),
    boundaryRespect: clamp(round(totals.boundaryRespect), -1, 1),
    pressureSignal: clamp01(round(totals.pressureSignal)),
    repairSignal: clamp(round(totals.repairSignal), -1, 1),
    intimacySignal: clamp(round(totals.intimacySignal), -1, 1),
    confidence: input.extraction.confidence,
    evidence: adaptCoEExtractionToEvidence(input.extraction),
  });

  return {
    ...relational,
    summary: summarizeModelRelationalAppraisal(relational),
  };
}

function buildLegacyEvidence(appraisal: AppraisalVector): CoEEvidence[] {
  const candidates: Array<CoEEvidence | null> = [
    Math.abs(appraisal.goalCongruence) >= 0.15
      ? {
          source: 'legacy_appraisal',
          key: 'warmth_signal',
          summary:
            appraisal.goalCongruence >= 0
              ? 'Legacy appraisal detected relationship-congruent warmth.'
              : 'Legacy appraisal detected relationship-incongruent friction.',
          weight: round(Math.abs(appraisal.goalCongruence)),
          confidence: 0.75,
          valence: round(appraisal.goalCongruence),
        }
      : null,
    Math.abs(appraisal.reciprocity) >= 0.15
      ? {
          source: 'legacy_appraisal',
          key: 'reciprocity_signal',
          summary:
            appraisal.reciprocity >= 0
              ? 'Legacy appraisal detected reciprocal engagement.'
              : 'Legacy appraisal detected one-sided interaction.',
          weight: round(Math.abs(appraisal.reciprocity)),
          confidence: 0.7,
          valence: round(appraisal.reciprocity),
        }
      : null,
    Math.abs(appraisal.normAlignment) >= 0.15
      ? {
          source: 'legacy_appraisal',
          key: 'boundary_respect',
          summary:
            appraisal.normAlignment >= 0
              ? 'Legacy appraisal detected phase-aligned boundary respect.'
              : 'Legacy appraisal detected a likely boundary or norm violation.',
          weight: round(Math.abs(appraisal.normAlignment)),
          confidence: 0.7,
          valence: round(appraisal.normAlignment),
        }
      : null,
    appraisal.pressureIntrusiveness >= 0.1
      ? {
          source: 'legacy_appraisal',
          key: 'pressure_signal',
          summary: 'Legacy appraisal detected user pressure or intrusiveness.',
          weight: round(appraisal.pressureIntrusiveness),
          confidence: 0.8,
          valence: round(-appraisal.pressureIntrusiveness),
        }
      : null,
    Math.abs(centeredSignal(appraisal.attachmentSecurity)) >= 0.15
      ? {
          source: 'legacy_appraisal',
          key: 'safety_signal',
          summary:
            appraisal.attachmentSecurity >= 0.5
              ? 'Legacy appraisal detected relational safety.'
              : 'Legacy appraisal detected relational insecurity.',
          weight: round(Math.abs(centeredSignal(appraisal.attachmentSecurity))),
          confidence: 0.65,
          valence: round(centeredSignal(appraisal.attachmentSecurity)),
        }
      : null,
  ];

  return candidates
    .filter((candidate): candidate is CoEEvidence => Boolean(candidate))
    .map((candidate) => CoEEvidenceSchema.parse(candidate));
}

function summarizeRelationalAppraisal(appraisal: RelationalAppraisal): string {
  if (appraisal.pressureSignal >= 0.35) {
    return 'Adapted from the legacy heuristic path with pressure as the dominant signal.';
  }
  if (appraisal.warmthSignal >= 0.2) {
    return 'Adapted from the legacy heuristic path with positive warmth leading the turn.';
  }
  if (appraisal.repairSignal >= 0.2) {
    return 'Adapted from the legacy heuristic path with repair momentum present.';
  }
  if (appraisal.boundaryRespect <= -0.2) {
    return 'Adapted from the legacy heuristic path with a boundary violation signal.';
  }
  return 'Adapted from the legacy heuristic path with mixed relational signals.';
}

export function adaptLegacyAppraisalToRelationalAppraisal(
  appraisal: AppraisalVector
): RelationalAppraisal {
  const safetySignal = clamp(
    centeredSignal(appraisal.controllability) * 0.4 +
      centeredSignal(appraisal.certainty) * 0.2 +
      centeredSignal(appraisal.attachmentSecurity) * 0.4,
    -1,
    1
  );
  const repairSignal = clamp(
    appraisal.goalCongruence * 0.45 +
      appraisal.reciprocity * 0.25 +
      centeredSignal(appraisal.attachmentSecurity) * 0.2 -
      appraisal.pressureIntrusiveness * 0.6,
    -1,
    1
  );
  const intimacySignal = clamp(
    appraisal.goalCongruence * 0.4 +
      appraisal.reciprocity * 0.2 +
      appraisal.normAlignment * 0.2 +
      centeredSignal(appraisal.attachmentSecurity) * 0.2 -
      appraisal.pressureIntrusiveness * 0.8,
    -1,
    1
  );

  const relational = RelationalAppraisalSchema.parse({
    source: 'legacy_heuristic',
    summary: 'placeholder',
    warmthSignal: appraisal.goalCongruence,
    reciprocitySignal: appraisal.reciprocity,
    safetySignal,
    boundaryRespect: appraisal.normAlignment,
    pressureSignal: appraisal.pressureIntrusiveness,
    repairSignal,
    intimacySignal,
    confidence: clamp(0.5 + Math.abs(appraisal.certainty - 0.5), 0, 1),
    evidence: buildLegacyEvidence(appraisal),
  });

  return {
    ...relational,
    summary: summarizeRelationalAppraisal(relational),
  };
}

export function adaptRelationalAppraisalToLegacyAppraisal(
  appraisal: RelationalAppraisal
): AppraisalVector {
  return {
    goalCongruence: clamp(
      round(
        appraisal.warmthSignal * 0.55 +
          appraisal.reciprocitySignal * 0.2 +
          appraisal.repairSignal * 0.2 -
          appraisal.pressureSignal * 0.45
      ),
      -1,
      1
    ),
    controllability: clamp01(
      round(0.5 + appraisal.safetySignal * 0.22 + appraisal.boundaryRespect * 0.18 - appraisal.pressureSignal * 0.25)
    ),
    certainty: clamp01(
      round(0.5 + appraisal.reciprocitySignal * 0.12 + appraisal.boundaryRespect * 0.12 - appraisal.pressureSignal * 0.1)
    ),
    normAlignment: clamp(round(appraisal.boundaryRespect), -1, 1),
    attachmentSecurity: clamp01(
      round(0.5 + appraisal.safetySignal * 0.3 + appraisal.warmthSignal * 0.1 - appraisal.pressureSignal * 0.15)
    ),
    reciprocity: clamp(round(appraisal.reciprocitySignal), -1, 1),
    pressureIntrusiveness: clamp01(round(appraisal.pressureSignal)),
    novelty: clamp01(
      round(0.45 + Math.abs(appraisal.intimacySignal) * 0.18 + appraisal.pressureSignal * 0.12)
    ),
    selfRelevance: clamp01(
      round(
        0.5 +
          Math.abs(appraisal.intimacySignal) * 0.12 +
          Math.abs(appraisal.repairSignal) * 0.08 +
          appraisal.pressureSignal * 0.1
      )
    ),
  };
}

export function adaptLegacyPairMetricDelta(input: {
  before: RelationshipMetrics;
  after: RelationshipMetrics;
}): PairMetricDelta {
  return PairMetricDeltaSchema.parse({
    affinity: round(input.after.affinity - input.before.affinity),
    trust: round(input.after.trust - input.before.trust),
    intimacyReadiness: round(
      input.after.intimacyReadiness - input.before.intimacyReadiness
    ),
    conflict: round(input.after.conflict - input.before.conflict),
  });
}

export function adaptLegacyEmotionUpdateProposal(input: {
  appraisal: AppraisalVector;
  emotionBefore: PADState;
  emotionAfter: PADState;
  pairMetricsBefore: RelationshipMetrics;
  pairMetricsAfter: RelationshipMetrics;
}): EmotionUpdateProposal {
  const relationalAppraisal = adaptLegacyAppraisalToRelationalAppraisal(input.appraisal);
  const pairDelta = adaptLegacyPairMetricDelta({
    before: input.pairMetricsBefore,
    after: input.pairMetricsAfter,
  });

  return EmotionUpdateProposalSchema.parse({
    source: 'legacy_heuristic',
    rationale: 'Adapted from the existing heuristic appraisal and PAD update path.',
    appraisal: relationalAppraisal,
    padDelta: {
      pleasure: round(input.emotionAfter.pleasure - input.emotionBefore.pleasure),
      arousal: round(input.emotionAfter.arousal - input.emotionBefore.arousal),
      dominance: round(input.emotionAfter.dominance - input.emotionBefore.dominance),
    },
    pairDelta,
    confidence: relationalAppraisal.confidence,
    evidence: relationalAppraisal.evidence,
  });
}

export function adaptLegacyEmotionTrace(input: {
  appraisal: AppraisalVector;
  emotionBefore: PADState;
  emotionAfter: PADState;
  pairMetricsBefore: RelationshipMetrics;
  pairMetricsAfter: RelationshipMetrics;
  coeContributions?: PADTransitionContribution[];
}): EmotionTrace {
  const relationalAppraisal = adaptLegacyAppraisalToRelationalAppraisal(input.appraisal);
  const proposal = adaptLegacyEmotionUpdateProposal(input);
  const evidence =
    relationalAppraisal.evidence.length > 0
      ? relationalAppraisal.evidence
      : input.coeContributions?.slice(0, 2).map((contribution) =>
          CoEEvidenceSchema.parse({
            source: 'legacy_appraisal',
            key: `${contribution.axis}_${contribution.source}`,
            summary: contribution.reason,
            weight: clamp(Math.abs(contribution.delta), 0, 1),
            confidence: 0.6,
            valence: clamp(contribution.delta, -1, 1),
          })
        ) ?? [];

  return EmotionTraceSchema.parse({
    source: 'legacy_heuristic',
    evidence,
    relationalAppraisal: {
      ...relationalAppraisal,
      evidence,
    },
    proposal: {
      ...proposal,
      evidence,
    },
    emotionBefore: input.emotionBefore,
    emotionAfter: input.emotionAfter,
    pairMetricsBefore: input.pairMetricsBefore,
    pairMetricsAfter: input.pairMetricsAfter,
    pairMetricDelta: adaptLegacyPairMetricDelta({
      before: input.pairMetricsBefore,
      after: input.pairMetricsAfter,
    }),
  });
}

export function parseCoEEvidenceModelOutput(raw: unknown): CoEEvidence {
  const candidate = parseLooseObject(raw, 'coe_evidence');
  return CoEEvidenceSchema.parse({
    source: candidate.source ?? 'model_inference',
    key: candidate.key ?? 'unspecified',
    summary: candidate.summary ?? 'No evidence summary provided.',
    weight: candidate.weight ?? 0.5,
    confidence: candidate.confidence ?? 0.5,
    valence: candidate.valence ?? 0,
  });
}

export function parseRelationalAppraisalModelOutput(raw: unknown): RelationalAppraisal {
  const candidate = parseLooseObject(raw, 'relational_appraisal');

  return RelationalAppraisalSchema.parse({
    source: candidate.source ?? 'model',
    summary: candidate.summary ?? 'No relational appraisal summary provided.',
    warmthSignal: candidate.warmthSignal ?? 0,
    reciprocitySignal: candidate.reciprocitySignal ?? 0,
    safetySignal: candidate.safetySignal ?? 0,
    boundaryRespect: candidate.boundaryRespect ?? 0,
    pressureSignal: candidate.pressureSignal ?? 0,
    repairSignal: candidate.repairSignal ?? 0,
    intimacySignal: candidate.intimacySignal ?? 0,
    confidence: candidate.confidence ?? 0.5,
    evidence: parseEvidenceArray(candidate.evidence),
  });
}

export function parseEmotionUpdateProposalModelOutput(
  raw: unknown
): EmotionUpdateProposal {
  const candidate = parseLooseObject(raw, 'emotion_update_proposal');
  const appraisal = parseRelationalAppraisalModelOutput(candidate.appraisal ?? {});
  const evidence = parseEvidenceArray(candidate.evidence ?? appraisal.evidence);

  return EmotionUpdateProposalSchema.parse({
    source: candidate.source ?? 'model',
    rationale: candidate.rationale ?? 'No emotion update rationale provided.',
    appraisal: {
      ...appraisal,
      evidence,
    },
    padDelta: parsePadStateLike(candidate.padDelta),
    pairDelta: parsePairMetricDeltaLike(candidate.pairDelta),
    confidence: candidate.confidence ?? appraisal.confidence,
    evidence,
  });
}

export function parseEmotionTraceModelOutput(raw: unknown): EmotionTrace {
  const candidate = parseLooseObject(raw, 'emotion_trace');
  const relationalAppraisal = parseRelationalAppraisalModelOutput(
    candidate.relationalAppraisal ?? {}
  );
  const proposalCandidate =
    candidate.proposal === undefined ? {} : parseLooseObject(candidate.proposal, 'proposal');
  const evidence = parseEvidenceArray(
    candidate.evidence ?? proposalCandidate.evidence ?? relationalAppraisal.evidence
  );
  const proposal = parseEmotionUpdateProposalModelOutput({
    ...proposalCandidate,
    appraisal: proposalCandidate.appraisal ?? relationalAppraisal,
    evidence,
  });

  return EmotionTraceSchema.parse({
    source: candidate.source ?? proposal.source,
    evidence,
    relationalAppraisal: {
      ...relationalAppraisal,
      evidence,
    },
    proposal,
    emotionBefore: parsePadStateLike(candidate.emotionBefore),
    emotionAfter: parsePadStateLike(candidate.emotionAfter),
    pairMetricsBefore: parseRelationshipMetricsLike(candidate.pairMetricsBefore),
    pairMetricsAfter: parseRelationshipMetricsLike(candidate.pairMetricsAfter),
    pairMetricDelta: parsePairMetricDeltaLike(candidate.pairMetricDelta),
  });
}
