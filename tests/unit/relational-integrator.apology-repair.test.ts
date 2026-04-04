import assert from 'node:assert/strict';
import test from 'node:test';
import { runIntegrator, buildAppraisal, buildMetrics, createRuntimeEmotionState } from './_integrator-helpers';

test('T4 apology-repair: trust recovers', () => {
  const result = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: -0.3, arousal: 0.2, dominance: -0.1 }),
    currentMetrics: buildMetrics({ trust: 40, affinity: 45, conflict: 25 }),
    appraisal: buildAppraisal({ warmthImpact: 0.3, repairImpact: 0.7, respectImpact: 0.5, certainty: 0.75 }),
  });
  assert.ok(result.pairDelta.trust > 0, `trust should increase, got ${result.pairDelta.trust}`);
  assert.ok(result.pairDelta.conflict < 0, 'conflict should decrease');
});
