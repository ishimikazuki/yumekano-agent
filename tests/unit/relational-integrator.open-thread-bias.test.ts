import assert from 'node:assert/strict';
import test from 'node:test';
import { runIntegrator, buildAppraisal, buildMetrics, buildOpenThread, createRuntimeEmotionState } from './_integrator-helpers';

test('T4 open-thread-bias: open threads affect slow mood', () => {
  const withThreads = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.1, arousal: 0, dominance: 0 }),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal({ warmthImpact: 0.3, certainty: 0.6 }),
    openThreads: [buildOpenThread({ severity: 0.9 }), buildOpenThread({ severity: 0.7, key: 'thread2', id: '00000000-0000-4000-8000-000000000099' })],
  });
  const withoutThreads = runIntegrator({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0.1, arousal: 0, dominance: 0 }),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal({ warmthImpact: 0.3, certainty: 0.6 }),
    openThreads: [],
  });
  const threadContribs = withThreads.contributions.filter(c => c.source === 'open_thread_bias');
  assert.ok(threadContribs.length > 0 || withThreads.padDelta.pleasure !== withoutThreads.padDelta.pleasure, 'open threads should influence result');
});
