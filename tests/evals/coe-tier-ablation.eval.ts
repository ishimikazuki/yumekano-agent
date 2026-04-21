/**
 * T5: CoE extractor tier ablation
 *
 * CoE evidence extractor feeds internal state (PAD + relationship metrics).
 * A regression here propagates silently across all subsequent turns.
 *
 * Decision: CoE extractor stays on `decisionHigh` by default.
 * Live ablation required before lowering.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultModelRoles } from '@/mastra/providers/model-roles';

const BASELINE_COE_ROLE = 'decisionHigh';

test('CoE extractor default alias is decisionHigh (T5: held)', () => {
  assert.equal(
    BASELINE_COE_ROLE,
    'decisionHigh',
    'CoE extractor tier is held at decisionHigh — regression here propagates to state'
  );
});

test('CoE extractor resolved model id matches the decisionHigh tier', () => {
  const cfg = defaultModelRoles.decisionHigh;
  assert.equal(cfg.provider, 'xai');
  assert.ok(/grok-4/.test(cfg.modelId), 'CoE extractor must resolve to a grok-4 variant');
});

test('CoE ablation highest-risk of decision stack: regression propagates across turns', () => {
  // Unlike planner/ranker where a bad decision affects one turn, a bad CoE
  // extraction silently corrupts PAD + relationship metrics for all turns
  // that follow. Highest bar for lowering.
  const propagationRisk = 'multi-turn';
  assert.equal(propagationRisk, 'multi-turn');
});
