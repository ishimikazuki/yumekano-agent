import assert from 'node:assert/strict';
import test from 'node:test';
import { runIntegrator, buildAppraisal, buildMetrics, RELATIONSHIP_PHASE, buildOpenThread, createRuntimeEmotionState } from './_integrator-helpers';

test('T4 sustained-pressure: triggers guardrail', () => {
  const result = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: -0.1, arousal: 0.3, dominance: -0.2 }),
    currentMetrics: buildMetrics({ trust: 45, affinity: 50, conflict: 30 }),
    appraisal: buildAppraisal({ pressureImpact: 0.8, threatImpact: 0.4, boundarySignal: -0.3, certainty: 0.85 }),
    currentPhase: RELATIONSHIP_PHASE,
    openThreads: [buildOpenThread({ severity: 0.8 })],
  });
  assert.ok(result.appliedGuardrails.some(g => g === 'sustainedPressure'), 'should trigger sustainedPressure guardrail');
});
