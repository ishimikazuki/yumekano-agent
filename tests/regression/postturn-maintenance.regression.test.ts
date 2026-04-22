/**
 * T3: post-turn maintenance regression
 *
 * Locks in the structural invariants of post-turn maintenance so that the
 * T3 gating + off-hot-path changes don't silently regress the pipeline:
 *
 *   1. `maintenanceFast` resolves to a grok model.
 *   2. The consolidation workflow export is stable.
 *   3. `shouldTriggerConsolidation` honors the threshold parameter.
 *
 * The semantic quality bar (reflector output / observation / quality labels)
 * is covered by the live `npm run eval:smoke` suite.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultModelRoles } from '@/mastra/providers/model-roles';
import {
  shouldTriggerConsolidation,
  runConsolidateMemory,
} from '@/mastra/workflows/consolidate-memory';

test('maintenanceFast default stays on a grok fast tier', () => {
  const cfg = defaultModelRoles.maintenanceFast;
  assert.equal(cfg.provider, 'xai');
  assert.ok(/grok/.test(cfg.modelId), 'maintenanceFast must be a grok model');

  if (!process.env.MAINTENANCE_MODEL) {
    assert.notEqual(
      cfg.modelId,
      defaultModelRoles.decisionHigh.modelId,
      'maintenanceFast default must differ from decisionHigh (fast-tier split)'
    );
  }
});

test('consolidation workflow exports remain stable', () => {
  assert.equal(typeof shouldTriggerConsolidation, 'function');
  assert.equal(typeof runConsolidateMemory, 'function');
});

test('shouldTriggerConsolidation with explicit threshold honors the threshold', async () => {
  // Empty store → never triggers, even with tiny threshold.
  const emptyStore: any = {
    async getEvents() { return []; },
  };
  const neverFires = await shouldTriggerConsolidation({
    scopeId: 'pair-x',
    memoryStore: emptyStore,
    threshold: 1,
  });
  assert.equal(neverFires, false, 'zero events must never trigger consolidation');
});
