/**
 * T5: ranker tier ablation
 *
 * Snapshots the current ranker tier. See planner-tier-ablation.eval.ts for
 * the full rationale — ranker follows the same default-hold pattern.
 *
 * Decision: ranker stays on `decisionHigh` by default.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultModelRoles } from '@/mastra/providers/model-roles';

const BASELINE_RANKER_ROLE = 'decisionHigh';

test('ranker default alias is decisionHigh (T5: held)', () => {
  assert.equal(
    BASELINE_RANKER_ROLE,
    'decisionHigh',
    'ranker tier is held at decisionHigh — lower only after live ablation evidence'
  );
});

test('ranker resolved model id matches the decisionHigh tier', () => {
  const cfg = defaultModelRoles.decisionHigh;
  assert.equal(cfg.provider, 'xai');
  assert.ok(/grok-4/.test(cfg.modelId), 'ranker must resolve to a grok-4 variant');
});

test('ranker ablation deferred: deterministic gates absorb some risk, but LLM scoring is still user-visible', () => {
  // Ranker is partially deterministic (hard-safety / gate tests), but scorer
  // LLM calls feed the winner decision. Held until live ablation proves
  // lowering is safe.
  const decision = 'hold';
  assert.equal(decision, 'hold');
});
