import assert from 'node:assert/strict';
import test from 'node:test';
import { runIntegrator, buildAppraisal, buildMetrics, createRuntimeEmotionState } from './_integrator-helpers';

test('T4 quiet-turn-decay: emotion decays toward baseline', () => {
  const result = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.5, arousal: 0.4, dominance: 0.3 }),
    currentMetrics: buildMetrics({ trust: 80, affinity: 85 }),
    appraisal: buildAppraisal({ warmthImpact: 0.01, certainty: 0.2 }),
    turnsSinceLastUpdate: 6,
  });
  assert.ok(result.quietTurn, 'should be detected as quiet turn');
  const decayContribs = result.contributions.filter(c => c.source === 'decay');
  assert.ok(decayContribs.length > 0, 'should have decay contributions');
});
