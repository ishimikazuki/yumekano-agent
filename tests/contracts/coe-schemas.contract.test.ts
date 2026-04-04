/**
 * T3: CoE schema contract test
 *
 * Verifies that all required CoE types and schemas exist and are importable.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('T3 CoEEvidence schema/type exists', async () => {
  const mod = await import('@/lib/schemas');
  assert.ok(mod.CoEEvidenceSchema, 'CoEEvidenceSchema should be exported');
});

test('T3 RelationalAppraisal schema/type exists', async () => {
  const mod = await import('@/lib/schemas');
  assert.ok(mod.RelationalAppraisalSchema, 'RelationalAppraisalSchema should be exported');
});

test('T3 EmotionUpdateProposal schema/type exists', async () => {
  const mod = await import('@/lib/schemas');
  assert.ok(mod.EmotionUpdateProposalSchema, 'EmotionUpdateProposalSchema should be exported');
});

test('T3 PairMetricDelta schema/type exists', async () => {
  const mod = await import('@/lib/schemas');
  assert.ok(mod.PairMetricDeltaSchema, 'PairMetricDeltaSchema should be exported');
});

test('T3 EmotionTrace schema/type exists', async () => {
  const mod = await import('@/lib/schemas');
  assert.ok(mod.EmotionTraceSchema, 'EmotionTraceSchema should be exported');
});

test('T3 PADTransitionContribution schema/type exists', async () => {
  const mod = await import('@/lib/schemas');
  assert.ok(mod.PADTransitionContributionSchema, 'PADTransitionContributionSchema should be exported');
});
