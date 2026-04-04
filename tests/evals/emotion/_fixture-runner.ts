/**
 * Shared fixture runner for CoE emotion contract tests.
 * Each fixture test imports this and runs a specific fixture by ID.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmotionUpdateProposal, RelationalAppraisal } from '@/lib/schemas';
import {
  parseCoEEvidenceModelOutput,
  parseRelationalAppraisalModelOutput,
  parseEmotionUpdateProposalModelOutput,
  parseEmotionTraceModelOutput,
} from '@/lib/adapters/coe-emotion-contract';
import {
  coeEmotionContractRegressionFixtures,
  type CoEEmotionContractFixtureTurn,
  type NumericBand,
} from '../../fixtures/coe-emotion-contract-regression-fixtures';

function inBand(value: number, band: NumericBand): boolean {
  return value >= band.min && value <= band.max;
}

function assertInBand(value: number, band: NumericBand, context: string): void {
  assert.equal(inBand(value, band), true, `${context} expected [${band.min}, ${band.max}], got ${value}`);
}

function assertPadDeltaBands(proposal: EmotionUpdateProposal, turn: CoEEmotionContractFixtureTurn, label: string) {
  for (const axis of ['pleasure', 'arousal', 'dominance'] as const) {
    assertInBand(proposal.padDelta[axis], turn.expected.padDeltaBand[axis], `${label} padDelta.${axis}`);
  }
}

function assertPairMetricBands(proposal: EmotionUpdateProposal, turn: CoEEmotionContractFixtureTurn, label: string) {
  for (const metric of ['affinity', 'trust', 'intimacyReadiness', 'conflict'] as const) {
    assertInBand(proposal.pairMetricDelta[metric], turn.expected.pairMetricDeltaBand[metric], `${label} pairMetricDelta.${metric}`);
  }
}

function assertAppraisalBands(appraisal: RelationalAppraisal, turn: CoEEmotionContractFixtureTurn, label: string) {
  for (const [axis, band] of Object.entries(turn.expected.appraisalBand) as Array<[keyof RelationalAppraisal, NumericBand]>) {
    assertInBand(appraisal[axis], band, `${label} appraisal.${axis}`);
  }
}

const BASE_EMOTION = { pleasure: 0, arousal: 0, dominance: 0 };
const BASE_PAIR = { affinity: 50, trust: 50, intimacyReadiness: 20, conflict: 10 };

export function runFixtureById(fixtureId: string) {
  const fixture = coeEmotionContractRegressionFixtures.find((f) => f.id === fixtureId);

  test(`fixture ${fixtureId} exists in corpus`, () => {
    assert.ok(fixture, `Missing fixture: ${fixtureId}`);
  });

  if (!fixture) return;

  fixture.turns.forEach((turn, index) => {
    const label = `${fixtureId} turn-${index + 1} (${turn.label})`;

    test(`${label}: evidence parses correctly`, () => {
      const parsed = turn.evidenceRaw.map(parseCoEEvidenceModelOutput);
      assert.ok(parsed.length > 0, `${label} evidence must not be empty`);
      for (const evidence of parsed) {
        assert.ok(evidence.acts.length > 0, `${label} acts must not be empty`);
        assert.ok(evidence.evidenceSpans.length > 0, `${label} evidenceSpans must not be empty`);
      }
    });

    test(`${label}: appraisal within expected bands`, () => {
      const appraisal = parseRelationalAppraisalModelOutput(turn.appraisalRaw);
      assertAppraisalBands(appraisal, turn, label);
    });

    test(`${label}: PAD delta within expected bands`, () => {
      const proposal = parseEmotionUpdateProposalModelOutput(turn.proposalRaw);
      assertPadDeltaBands(proposal, turn, label);
    });

    test(`${label}: pair metric delta within expected bands`, () => {
      const proposal = parseEmotionUpdateProposalModelOutput(turn.proposalRaw);
      assertPairMetricBands(proposal, turn, label);
    });

    test(`${label}: emotion trace round-trips`, () => {
      const proposal = parseEmotionUpdateProposalModelOutput(turn.proposalRaw);
      const emotionAfter = {
        pleasure: Math.max(-1, Math.min(1, BASE_EMOTION.pleasure + proposal.padDelta.pleasure)),
        arousal: Math.max(-1, Math.min(1, BASE_EMOTION.arousal + proposal.padDelta.arousal)),
        dominance: Math.max(-1, Math.min(1, BASE_EMOTION.dominance + proposal.padDelta.dominance)),
      };
      const pairMetricsAfter = {
        affinity: Math.max(0, Math.min(100, BASE_PAIR.affinity + proposal.pairMetricDelta.affinity)),
        trust: Math.max(0, Math.min(100, BASE_PAIR.trust + proposal.pairMetricDelta.trust)),
        intimacyReadiness: Math.max(0, Math.min(100, BASE_PAIR.intimacyReadiness + proposal.pairMetricDelta.intimacyReadiness)),
        conflict: Math.max(0, Math.min(100, BASE_PAIR.conflict + proposal.pairMetricDelta.conflict)),
      };

      const trace = parseEmotionTraceModelOutput({
        evidence: turn.evidenceRaw,
        relationalAppraisal: turn.appraisalRaw,
        proposal,
        emotionBefore: BASE_EMOTION,
        emotionAfter,
        pairMetricsBefore: BASE_PAIR,
        pairMetricsAfter,
        pairMetricDelta: proposal.pairMetricDelta,
      });
      assert.deepEqual(trace.proposal.pairMetricDelta, proposal.pairMetricDelta);
    });
  });
}
