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

test('emotion contract schemas accept a fully typed contract payload', () => {
  const evidence = CoEEvidenceSchema.parse({
    source: 'user_message',
    key: 'repair_bid',
    summary: 'User apologized and named the harm.',
    weight: 0.8,
    confidence: 0.9,
    valence: 0.6,
  });

  const appraisal = RelationalAppraisalSchema.parse({
    source: 'model',
    summary: 'Repair is plausible and pressure is low.',
    warmthSignal: 0.4,
    reciprocitySignal: 0.2,
    safetySignal: 0.3,
    boundaryRespect: 0.5,
    pressureSignal: 0.1,
    repairSignal: 0.6,
    intimacySignal: 0.2,
    confidence: 0.8,
    evidence: [evidence],
  });

  const pairDelta = PairMetricDeltaSchema.parse({
    affinity: 1.2,
    trust: 2.4,
    intimacyReadiness: 0.5,
    conflict: -1.8,
  });

  const proposal = EmotionUpdateProposalSchema.parse({
    source: 'model',
    rationale: 'Lean into repair while keeping the tempo calm.',
    appraisal,
    padDelta: {
      pleasure: 0.08,
      arousal: -0.02,
      dominance: 0.04,
    },
    pairDelta,
    confidence: 0.76,
    evidence: [evidence],
  });

  const trace = EmotionTraceSchema.parse({
    source: 'model',
    evidence: [evidence],
    relationalAppraisal: appraisal,
    proposal,
    emotionBefore: { pleasure: -0.1, arousal: 0.2, dominance: -0.2 },
    emotionAfter: { pleasure: -0.02, arousal: 0.18, dominance: -0.16 },
    pairMetricsBefore: {
      affinity: 52,
      trust: 46,
      intimacyReadiness: 18,
      conflict: 20,
    },
    pairMetricsAfter: {
      affinity: 53.2,
      trust: 48.4,
      intimacyReadiness: 18.5,
      conflict: 18.2,
    },
    pairMetricDelta: pairDelta,
  });

  assert.equal(trace.proposal.pairDelta.trust, 2.4);
});

test('partial relational appraisal model output is defaulted into a schema-valid contract', () => {
  const appraisal = parseRelationalAppraisalModelOutput({
    warmthSignal: 0.25,
    evidence: [{ summary: 'User praised her effort.' }],
  });

  assert.equal(appraisal.source, 'model');
  assert.equal(appraisal.warmthSignal, 0.25);
  assert.equal(appraisal.pressureSignal, 0);
  assert.equal(appraisal.evidence[0].source, 'model_inference');
  assert.equal(appraisal.evidence[0].key, 'unspecified');
});

test('partial emotion update proposal model output fills nested defaults', () => {
  const proposal = parseEmotionUpdateProposalModelOutput({
    rationale: 'Keep the response steady.',
    appraisal: {
      safetySignal: 0.3,
      repairSignal: 0.4,
    },
    padDelta: {
      pleasure: 0.05,
    },
  });

  assert.equal(proposal.source, 'model');
  assert.equal(proposal.padDelta.pleasure, 0.05);
  assert.equal(proposal.padDelta.arousal, 0);
  assert.equal(proposal.pairDelta.conflict, 0);
  assert.equal(proposal.appraisal.repairSignal, 0.4);
});

test('partial emotion trace model output is normalized into a complete trace contract', () => {
  const trace = parseEmotionTraceModelOutput({
    relationalAppraisal: {
      pressureSignal: 0.7,
      boundaryRespect: -0.5,
    },
    proposal: {
      rationale: 'Hold the line and avoid warming the turn.',
      padDelta: {
        pleasure: -0.12,
        dominance: -0.08,
      },
    },
    emotionAfter: {
      pleasure: -0.22,
    },
    pairMetricsAfter: {
      conflict: 28,
    },
  });

  assert.equal(trace.source, 'model');
  assert.equal(trace.relationalAppraisal.pressureSignal, 0.7);
  assert.equal(trace.proposal.padDelta.dominance, -0.08);
  assert.equal(trace.emotionBefore.arousal, 0);
  assert.equal(trace.pairMetricsBefore.trust, 50);
  assert.equal(trace.pairMetricsAfter.conflict, 28);
});

test('invalid model outputs fail fast for the new emotion contracts', () => {
  assert.throws(
    () =>
      parseCoEEvidenceModelOutput({
        summary: 'Bad numeric field',
        weight: 'heavy',
      }),
    /number/i
  );

  assert.throws(
    () =>
      parseEmotionUpdateProposalModelOutput({
        rationale: 'Not valid',
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
