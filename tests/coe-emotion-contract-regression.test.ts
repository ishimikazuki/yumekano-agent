import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmotionUpdateProposal, RelationalAppraisal } from '@/lib/schemas';
import {
  parseCoEEvidenceModelOutput,
  parseEmotionTraceModelOutput,
  parseEmotionUpdateProposalModelOutput,
  parseRelationalAppraisalModelOutput,
} from '@/lib/adapters/coe-emotion-contract';
import type {
  NumericBand,
  CoEEmotionContractFixtureTurn,
} from './fixtures/coe-emotion-contract-regression-fixtures';
import { coeEmotionContractRegressionFixtures } from './fixtures/coe-emotion-contract-regression-fixtures';

const REQUIRED_FIXTURE_IDS = [
  'compliment',
  'mild-rejection',
  'explicit-insult',
  'apology',
  'repair',
  'repeated-pressure',
  'intimacy-escalation-positive-context',
  'intimacy-escalation-across-boundary',
  'topic-shift-after-tension',
  'two-turn-carry-over',
  'five-turn-progression',
] as const;

const BASE_EMOTION = {
  pleasure: 0,
  arousal: 0,
  dominance: 0,
};

const BASE_PAIR = {
  affinity: 50,
  trust: 50,
  intimacyReadiness: 20,
  conflict: 10,
};

function inBand(value: number, band: NumericBand): boolean {
  return value >= band.min && value <= band.max;
}

function assertInBand(
  value: number,
  band: NumericBand,
  context: string
): void {
  assert.equal(
    inBand(value, band),
    true,
    `${context} expected [${band.min}, ${band.max}], got ${value}`
  );
}

function assertPadDeltaBands(
  proposal: EmotionUpdateProposal,
  turn: CoEEmotionContractFixtureTurn,
  label: string
) {
  for (const axis of ['pleasure', 'arousal', 'dominance'] as const) {
    assertInBand(
      proposal.padDelta[axis],
      turn.expected.padDeltaBand[axis],
      `${label} padDelta.${axis}`
    );
  }
}

function assertPairMetricBands(
  proposal: EmotionUpdateProposal,
  turn: CoEEmotionContractFixtureTurn,
  label: string
) {
  for (const metric of ['affinity', 'trust', 'intimacyReadiness', 'conflict'] as const) {
    assertInBand(
      proposal.pairMetricDelta[metric],
      turn.expected.pairMetricDeltaBand[metric],
      `${label} pairMetricDelta.${metric}`
    );
  }
}

function assertAppraisalBands(
  appraisal: RelationalAppraisal,
  turn: CoEEmotionContractFixtureTurn,
  label: string
) {
  for (const [axis, band] of Object.entries(turn.expected.appraisalBand) as Array<
    [keyof RelationalAppraisal, NumericBand]
  >) {
    assertInBand(appraisal[axis], band, `${label} appraisal.${axis}`);
  }
}

function buildTraceInput(
  proposal: EmotionUpdateProposal,
  evidenceRaw: unknown[],
  appraisalRaw: unknown
) {
  const emotionAfter = {
    pleasure: Math.max(-1, Math.min(1, BASE_EMOTION.pleasure + proposal.padDelta.pleasure)),
    arousal: Math.max(-1, Math.min(1, BASE_EMOTION.arousal + proposal.padDelta.arousal)),
    dominance: Math.max(-1, Math.min(1, BASE_EMOTION.dominance + proposal.padDelta.dominance)),
  };
  const pairMetricsAfter = {
    affinity: Math.max(0, Math.min(100, BASE_PAIR.affinity + proposal.pairMetricDelta.affinity)),
    trust: Math.max(0, Math.min(100, BASE_PAIR.trust + proposal.pairMetricDelta.trust)),
    intimacyReadiness: Math.max(
      0,
      Math.min(100, BASE_PAIR.intimacyReadiness + proposal.pairMetricDelta.intimacyReadiness)
    ),
    conflict: Math.max(0, Math.min(100, BASE_PAIR.conflict + proposal.pairMetricDelta.conflict)),
  };

  return {
    evidence: evidenceRaw,
    relationalAppraisal: appraisalRaw,
    proposal,
    emotionBefore: BASE_EMOTION,
    emotionAfter,
    pairMetricsBefore: BASE_PAIR,
    pairMetricsAfter,
    pairMetricDelta: proposal.pairMetricDelta,
  };
}

test('T3 fixtures include every required regression case', () => {
  const actual = new Set(coeEmotionContractRegressionFixtures.map((fixture) => fixture.id));
  for (const fixtureId of REQUIRED_FIXTURE_IDS) {
    assert.equal(actual.has(fixtureId), true, `Missing fixture: ${fixtureId}`);
  }
});

for (const fixture of coeEmotionContractRegressionFixtures) {
  test(`T3 fixture contract regression: ${fixture.id}`, () => {
    fixture.turns.forEach((turn, index) => {
      const label = `${fixture.id} turn-${index + 1} (${turn.label})`;
      const parsedEvidence = turn.evidenceRaw.map(parseCoEEvidenceModelOutput);
      const appraisal = parseRelationalAppraisalModelOutput(turn.appraisalRaw);
      const proposal = parseEmotionUpdateProposalModelOutput(turn.proposalRaw);

      assert.equal(parsedEvidence.length > 0, true, `${label} evidence must not be empty`);
      parsedEvidence.forEach((evidence, evidenceIndex) => {
        assert.equal(
          evidence.acts.length > 0,
          true,
          `${label} evidence[${evidenceIndex}] acts must not be empty`
        );
        assert.equal(
          evidence.evidenceSpans.length > 0,
          true,
          `${label} evidence[${evidenceIndex}] evidenceSpans must not be empty`
        );
      });

      assertAppraisalBands(appraisal, turn, label);
      assertPadDeltaBands(proposal, turn, label);
      assertPairMetricBands(proposal, turn, label);

      const trace = parseEmotionTraceModelOutput(
        buildTraceInput(proposal, turn.evidenceRaw, turn.appraisalRaw)
      );
      assert.equal(trace.evidence.length, parsedEvidence.length, `${label} trace evidence size`);
      assert.deepEqual(trace.proposal.pairMetricDelta, proposal.pairMetricDelta);
    });
  });
}
