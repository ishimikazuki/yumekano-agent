import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAppraisal } from '@/lib/rules/appraisal';
import { updatePAD } from '@/lib/rules/pad';
import { updateRelationshipMetrics } from '@/lib/rules/phase-runtime';
import {
  adaptLegacyAppraisalToRelationalAppraisal,
  adaptLegacyEmotionTrace,
  adaptLegacyEmotionUpdateProposal,
  adaptLegacyPairMetricDelta,
} from '@/lib/adapters/coe-emotion-contract';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createWorkingMemory,
} from './persona-test-helpers';

test('legacy appraisal path can be adapted into the new relational appraisal contract', () => {
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

  assert.equal(relational.source, 'legacy_heuristic');
  assert.equal(relational.warmthSignal, appraisal.goalCongruence);
  assert.equal(relational.boundaryRespect, appraisal.normAlignment);
  assert.ok(relational.pressureSignal > 0);
  assert.ok(relational.evidence.length > 0);
});

test('legacy PAD and pair updates adapt into the new proposal and trace contracts', () => {
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
  const proposal = adaptLegacyEmotionUpdateProposal({
    appraisal,
    emotionBefore: pairState.emotion.combined,
    emotionAfter: padUpdate.after.combined,
    pairMetricsBefore,
    pairMetricsAfter,
  });
  const trace = adaptLegacyEmotionTrace({
    appraisal,
    emotionBefore: pairState.emotion.combined,
    emotionAfter: padUpdate.after.combined,
    pairMetricsBefore,
    pairMetricsAfter,
    coeContributions: padUpdate.contributions,
  });

  assert.equal(proposal.source, 'legacy_heuristic');
  assert.equal(
    proposal.padDelta.pleasure,
    Number((padUpdate.after.combined.pleasure - pairState.emotion.combined.pleasure).toFixed(4))
  );
  assert.equal(proposal.pairDelta.trust, pairDelta.trust);
  assert.equal(trace.source, 'legacy_heuristic');
  assert.deepEqual(trace.pairMetricDelta, pairDelta);
  assert.equal(trace.proposal.rationale.includes('heuristic appraisal'), true);
  assert.ok(trace.evidence.length > 0);
});
