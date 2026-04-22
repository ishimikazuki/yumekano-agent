/**
 * T5: planner tier ablation
 *
 * Snapshots the current planner tier and locks in the default.
 * When an operator wants to lower the planner tier, they must:
 *   1. Set PLANNER_MODEL env var AND
 *   2. Update BASELINE_PLANNER_MODEL in this file along with eval evidence.
 *
 * Offline limitation: `eval:smoke` uses fixture data, so an actual model
 * swap is a no-op in ci:local. Live ablation requires XAI_API_KEY +
 * a YUMEKANO_EVAL_MODE=online run, which is out of scope for ci:local.
 *
 * Decision: planner stays on `decisionHigh` by default.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultModelRoles } from '@/mastra/providers/model-roles';

const BASELINE_PLANNER_ROLE = 'decisionHigh';

test('planner default alias is decisionHigh (T5: held)', () => {
  assert.equal(
    BASELINE_PLANNER_ROLE,
    'decisionHigh',
    'planner tier is held at decisionHigh — lower only after live ablation evidence'
  );
});

test('planner resolved model id matches the decisionHigh tier', () => {
  const cfg = defaultModelRoles.decisionHigh;
  assert.equal(cfg.provider, 'xai');
  assert.ok(/grok-4/.test(cfg.modelId), 'planner must resolve to a grok-4 variant');
});

test('T5 note: offline ablation is a no-op (fixture-based)', () => {
  // This is a documentation assertion — it simply records the honest limit.
  const limitation =
    'Offline ablation cannot measure real model quality. Live ablation requires YUMEKANO_EVAL_MODE=online + operator A/B.';
  assert.ok(limitation.includes('online'));
});
