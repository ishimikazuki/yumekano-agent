import assert from 'node:assert/strict';
import test from 'node:test';
import { runIntegrator, buildAppraisal, buildMetrics, createRuntimeEmotionState } from './_integrator-helpers';

test('T4 affectionate-carry-over: positive metrics accumulate', () => {
  const result = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.3, arousal: 0.1, dominance: 0.1 }),
    currentMetrics: buildMetrics({ trust: 70, affinity: 72 }),
    appraisal: buildAppraisal({ warmthImpact: 0.6, reciprocityImpact: 0.5, respectImpact: 0.4, certainty: 0.8 }),
  });
  assert.ok(result.pairDelta.affinity > 0, `affinity should increase, got ${result.pairDelta.affinity}`);
  assert.ok(result.padDelta.pleasure > 0, 'pleasure should increase');
});
