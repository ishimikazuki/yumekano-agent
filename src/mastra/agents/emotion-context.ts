import type {
  CoEEvidenceExtractorResult,
  LegacyEmotionTrace,
  LegacyEmotionComparison,
} from '@/lib/schemas';

export type AgentEmotionContext = {
  coeExtraction: CoEEvidenceExtractorResult;
  emotionTrace: LegacyEmotionTrace;
  legacyComparison?: LegacyEmotionComparison | null;
};

function formatInteractionActs(extraction: CoEEvidenceExtractorResult): string {
  if (extraction.interactionActs.length === 0) {
    return 'None';
  }

  return extraction.interactionActs
    .map((act) => {
      const span = act.evidenceSpans[0];
      return `- ${act.act} -> ${act.target} (${act.polarity}, intensity=${act.intensity.toFixed(
        2
      )}, confidence=${act.confidence.toFixed(2)}): ${span.text}`;
    })
    .join('\n');
}

function formatEvidence(trace: LegacyEmotionTrace): string {
  if (trace.evidence.length === 0) {
    return 'None';
  }

  return trace.evidence
    .map(
      (item) =>
        `- [${item.key}] ${item.summary} (weight=${item.weight.toFixed(
          2
        )}, confidence=${item.confidence.toFixed(2)}, valence=${item.valence.toFixed(2)})`
    )
    .join('\n');
}

export function formatEmotionContextSections(
  emotionContext?: AgentEmotionContext
): string {
  if (!emotionContext) {
    return `## CoE Interaction Acts
None

## CoE Evidence
None

## Relational Appraisal
None

## Proposed State Deltas
None`;
  }

  const { coeExtraction, emotionTrace, legacyComparison } = emotionContext;
  const appraisal = emotionTrace.relationalAppraisal;
  const proposal = emotionTrace.proposal;
  const legacyBlock = legacyComparison
    ? `

## Legacy Comparison
- Goal Congruence: ${legacyComparison.appraisal.goalCongruence.toFixed(2)}
- Reciprocity: ${legacyComparison.appraisal.reciprocity.toFixed(2)}
- Pressure: ${legacyComparison.appraisal.pressureIntrusiveness.toFixed(2)}
- Legacy PAD After: P=${legacyComparison.emotionAfter.pleasure.toFixed(
        2
      )}, A=${legacyComparison.emotionAfter.arousal.toFixed(
        2
      )}, D=${legacyComparison.emotionAfter.dominance.toFixed(2)}
- Legacy Pair Delta: trust=${legacyComparison.relationshipDeltas.trust.toFixed(
        2
      )}, affinity=${legacyComparison.relationshipDeltas.affinity.toFixed(
        2
      )}, conflict=${legacyComparison.relationshipDeltas.conflict.toFixed(
        2
      )}, intimacy=${legacyComparison.relationshipDeltas.intimacyReadiness.toFixed(2)}`
    : '';

  return `## CoE Interaction Acts
${formatInteractionActs(coeExtraction)}

## CoE Evidence
${formatEvidence(emotionTrace)}

## Relational Appraisal
- Summary: ${appraisal.summary}
- Warmth: ${appraisal.warmthSignal.toFixed(2)}
- Reciprocity: ${appraisal.reciprocitySignal.toFixed(2)}
- Safety: ${appraisal.safetySignal.toFixed(2)}
- Boundary Respect: ${appraisal.boundaryRespect.toFixed(2)}
- Pressure: ${appraisal.pressureSignal.toFixed(2)}
- Repair: ${appraisal.repairSignal.toFixed(2)}
- Intimacy: ${appraisal.intimacySignal.toFixed(2)}

## Proposed State Deltas
- PAD: P=${proposal.padDelta.pleasure.toFixed(2)}, A=${proposal.padDelta.arousal.toFixed(
    2
  )}, D=${proposal.padDelta.dominance.toFixed(2)}
- Pair: trust=${proposal.pairDelta.trust.toFixed(2)}, affinity=${proposal.pairDelta.affinity.toFixed(
    2
  )}, conflict=${proposal.pairDelta.conflict.toFixed(
    2
  )}, intimacy=${proposal.pairDelta.intimacyReadiness.toFixed(2)}${legacyBlock}`;
}
