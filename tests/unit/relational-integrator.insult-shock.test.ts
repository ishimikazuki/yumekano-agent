import assert from 'node:assert/strict';
import test from 'node:test';
import { runIntegrator, buildAppraisal, buildMetrics, createRuntimeEmotionState } from './_integrator-helpers';

test('T4 insult-shock: pleasure drops significantly', () => {
  const result = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.2, arousal: 0.1, dominance: 0.1 }),
    currentMetrics: buildMetrics({ trust: 60, affinity: 55 }),
    appraisal: buildAppraisal({ warmthImpact: -0.8, rejectionImpact: 0.7, respectImpact: -0.6, threatImpact: 0.5, certainty: 0.9 }),
  });
  assert.ok(result.padDelta.pleasure < -0.05, `pleasure delta should be negative, got ${result.padDelta.pleasure}`);
  assert.ok(result.pairDelta.trust < 0, 'trust should decrease');
  assert.ok(result.appliedGuardrails.length > 0, 'should trigger guardrail');
});
