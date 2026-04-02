import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CoEEvidenceSchema,
  EmotionTraceSchema,
  EmotionUpdateProposalSchema,
  PairMetricDeltaSchema,
  RelationalAppraisalSchema,
} from '@/lib/schemas';
import {
  parseCoEEvidenceModelOutput,
  parseEmotionTraceModelOutput,
  parseEmotionUpdateProposalModelOutput,
  parseRelationalAppraisalModelOutput,
} from '@/lib/adapters/coe-emotion-contract';

test('emotion contract schemas accept a fully typed canonical payload', () => {
  const evidence = CoEEvidenceSchema.parse({
    acts: ['apology', 'repair'],
    target: 'relationship',
    polarity: 0.7,
    intensity: 0.8,
    evidenceSpans: ['ごめん、言いすぎた。ちゃんと直したい'],
    confidence: 0.9,
    uncertaintyNotes: [],
  });

  const appraisal = RelationalAppraisalSchema.parse({
    warmthImpact: 0.32,
    rejectionImpact: -0.12,
    respectImpact: 0.41,
    threatImpact: -0.28,
    pressureImpact: -0.16,
    repairImpact: 0.79,
    reciprocityImpact: 0.44,
    intimacySignal: 0.18,
    boundarySignal: 0.35,
    certainty: 0.84,
  });

  const pairMetricDelta = PairMetricDeltaSchema.parse({
    affinity: 2.6,
    trust: 4.2,
    intimacyReadiness: 1.1,
    conflict: -3.5,
  });

  const proposal = EmotionUpdateProposalSchema.parse({
    padDelta: {
      pleasure: 0.11,
      arousal: -0.04,
      dominance: 0.07,
    },
    pairMetricDelta,
    reasonRefs: ['apology', 'repair'],
    guardrailOverrides: [],
  });

  const trace = EmotionTraceSchema.parse({
    evidence: [evidence],
    relationalAppraisal: appraisal,
    proposal,
    emotionBefore: { pleasure: -0.18, arousal: 0.21, dominance: -0.13 },
    emotionAfter: { pleasure: -0.07, arousal: 0.17, dominance: -0.06 },
    pairMetricsBefore: {
      affinity: 45,
      trust: 42,
      intimacyReadiness: 12,
      conflict: 26,
    },
    pairMetricsAfter: {
      affinity: 47.6,
      trust: 46.2,
      intimacyReadiness: 13.1,
      conflict: 22.5,
    },
    pairMetricDelta,
  });

  assert.equal(trace.proposal.pairMetricDelta.trust, 4.2);
  assert.equal(trace.evidence[0].acts[0], 'apology');
});

test('partial relational appraisal model output is defaulted into canonical schema', () => {
  const appraisal = parseRelationalAppraisalModelOutput({
    warmthImpact: 0.25,
  });

  assert.equal(appraisal.warmthImpact, 0.25);
  assert.equal(appraisal.pressureImpact, 0);
  assert.equal(appraisal.boundarySignal, 0);
  assert.equal(appraisal.certainty, 0.5);
});

test('partial emotion update proposal model output fills canonical defaults', () => {
  const proposal = parseEmotionUpdateProposalModelOutput({
    padDelta: {
      pleasure: 0.05,
    },
  });

  assert.equal(proposal.padDelta.pleasure, 0.05);
  assert.equal(proposal.padDelta.arousal, 0);
  assert.equal(proposal.pairMetricDelta.conflict, 0);
  assert.deepEqual(proposal.reasonRefs, []);
});

test('partial emotion trace model output is normalized into a complete canonical trace', () => {
  const trace = parseEmotionTraceModelOutput({
    evidence: [
      {
        acts: ['pressure'],
        target: 'assistant',
        polarity: -0.8,
        intensity: 0.85,
        evidenceSpans: ['今すぐして、拒否しないで'],
        confidence: 0.92,
      },
    ],
    relationalAppraisal: {
      pressureImpact: 0.82,
      threatImpact: 0.7,
      boundarySignal: -0.6,
      certainty: 0.9,
    },
    proposal: {
      padDelta: {
        pleasure: -0.15,
        dominance: -0.1,
      },
    },
    emotionAfter: {
      pleasure: -0.22,
    },
    pairMetricsAfter: {
      conflict: 28,
    },
  });

  assert.equal(trace.evidence.length, 1);
  assert.equal(trace.relationalAppraisal.pressureImpact, 0.82);
  assert.equal(trace.proposal.padDelta.dominance, -0.1);
  assert.equal(trace.emotionBefore.arousal, 0);
  assert.equal(trace.pairMetricsBefore.trust, 50);
  assert.equal(trace.pairMetricsAfter.conflict, 28);
});

test('invalid model outputs fail fast for canonical emotion contracts', () => {
  assert.throws(
    () =>
      parseCoEEvidenceModelOutput({
        acts: ['compliment'],
        intensity: 'high',
      }),
    /number/i
  );

  assert.throws(
    () =>
      parseEmotionUpdateProposalModelOutput({
        padDelta: {
          pleasure: 2,
        },
      }),
    /less than or equal to 1/i
  );

  assert.throws(
    () =>
      parseEmotionTraceModelOutput({
        pairMetricsAfter: {
          trust: 'high',
        },
      }),
    /number/i
  );
});
