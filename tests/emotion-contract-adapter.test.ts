import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAppraisal } from '@/lib/rules/appraisal';
import { updatePAD } from '@/lib/rules/pad';
import { updateRelationshipMetrics } from '@/lib/rules/phase-runtime';
import {
  adaptLegacyAppraisalToRelationalAppraisal,
  adaptLegacyEmotionTraceToEmotionContract,
  adaptLegacyEmotionUpdateProposalToEmotionContract,
  adaptLegacyPairMetricDelta,
} from '@/lib/adapters/coe-emotion-contract';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createWorkingMemory,
} from './persona-test-helpers';

test('legacy appraisal path can be adapted into canonical relational appraisal contract', () => {
  const characterVersion = createCharacterVersion();
  const pairState = createPairState({
    trust: 44,
    affinity: 42,
    intimacyReadiness: 12,
    conflict: 18,
  });
  const appraisal = computeAppraisal({
    userMessage: '今すぐキスして。拒否しないで',
    characterVersion,
    pairState,
    workingMemory: {
      ...createWorkingMemory(),
      activeTensionSummary: '距離の詰め方が少し怖い',
    },
    openThreads: [],
    recentDialogue: [
      { role: 'assistant', content: 'その話はまだ早いかな…' },
      { role: 'user', content: 'ちょっとくらいいいじゃん' },
    ],
    currentPhase: {
      ...createPhaseNode(),
      adultIntimacyEligibility: 'never',
    },
  });

  const relational = adaptLegacyAppraisalToRelationalAppraisal(appraisal);

  assert.equal(relational.warmthImpact, appraisal.goalCongruence);
  assert.equal(relational.boundarySignal, appraisal.normAlignment);
  assert.ok(relational.pressureImpact > 0);
  assert.ok(relational.certainty >= 0 && relational.certainty <= 1);
});

test('legacy PAD and pair updates adapt into canonical proposal and trace contracts', () => {
  const characterVersion = createCharacterVersion();
  const pairState = createPairState({
    trust: 68,
    affinity: 70,
    intimacyReadiness: 40,
    conflict: 4,
  });
  const workingMemory = {
    ...createWorkingMemory(),
    activeTensionSummary: null,
    knownCorrections: [],
    knownLikes: [],
    knownDislikes: [],
  };
  const appraisal = computeAppraisal({
    userMessage: '急がせないよ。手つないでもいい？ ちゃんと大切にしたいんだ',
    characterVersion,
    pairState,
    workingMemory,
    openThreads: [],
    recentDialogue: [
      { role: 'assistant', content: '一緒にいると安心するね' },
      { role: 'user', content: '俺もそう思ってるよ' },
    ],
    currentPhase: createPhaseNode(),
  });
  const padUpdate = updatePAD({
    currentEmotion: pairState.emotion,
    appraisal,
    emotionSpec: characterVersion.emotion,
    hasOpenThreads: false,
    turnsSinceLastUpdate: 1,
    now: new Date('2026-03-25T00:00:00.000Z'),
  });
  const pairMetricsBefore = {
    affinity: pairState.affinity,
    trust: pairState.trust,
    intimacyReadiness: pairState.intimacyReadiness,
    conflict: pairState.conflict,
  };
  const pairMetricsAfter = updateRelationshipMetrics({
    current: pairState,
    appraisal,
    emotionBefore: pairState.emotion.combined,
    emotionAfter: padUpdate.after.combined,
  });

  const pairDelta = adaptLegacyPairMetricDelta({
    before: pairMetricsBefore,
    after: pairMetricsAfter,
  });
  const proposal = adaptLegacyEmotionUpdateProposalToEmotionContract({
    appraisal,
    emotionBefore: pairState.emotion.combined,
    emotionAfter: padUpdate.after.combined,
    pairMetricsBefore,
    pairMetricsAfter,
  });
  const trace = adaptLegacyEmotionTraceToEmotionContract({
    appraisal,
    emotionBefore: pairState.emotion.combined,
    emotionAfter: padUpdate.after.combined,
    pairMetricsBefore,
    pairMetricsAfter,
    coeContributions: padUpdate.contributions,
  });

  assert.equal(
    proposal.padDelta.pleasure,
    Number((padUpdate.after.combined.pleasure - pairState.emotion.combined.pleasure).toFixed(4))
  );
  assert.equal(proposal.pairMetricDelta.trust, pairDelta.trust);
  assert.deepEqual(trace.pairMetricDelta, pairDelta);
  assert.ok(trace.evidence.length > 0);
  assert.ok(trace.proposal.reasonRefs.length > 0);
});
