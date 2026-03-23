import assert from 'node:assert/strict';
import test from 'node:test';
import type { PhaseEdge } from '@/lib/schemas';
import {
  buildPhaseEngineRuntimeContext,
  deriveSandboxPhaseTiming,
  resolvePhaseTransition,
  updateRelationshipMetrics,
} from '@/lib/rules/phase-runtime';
import {
  createEmotion,
  createPairState,
} from './persona-test-helpers';

test('phase runtime context detects authored topic and support events from dialogue', () => {
  const edges: PhaseEdge[] = [
    {
      id: 'station_to_cafe',
      from: 'station_meeting',
      to: 'cafe_thank_you',
      allMustPass: true,
      conditions: [
        { type: 'metric', field: 'trust', op: '>=', value: 25 },
        { type: 'topic', topicKey: 'thanks_or_kindness', minCount: 1 },
      ],
    },
    {
      id: 'walk_to_backstage',
      from: 'walk_after_cafe',
      to: 'backstage_invitation',
      allMustPass: true,
      conditions: [
        { type: 'metric', field: 'trust', op: '>=', value: 50 },
        { type: 'event', eventKey: 'supported_after_insecurity', exists: true },
      ],
    },
  ];

  const context = buildPhaseEngineRuntimeContext({
    edges,
    pairState: createPairState({ activePhaseId: 'station_meeting', trust: 55 }),
    pad: createEmotion(),
    openThreads: [],
    recentDialogue: [
      { role: 'assistant', content: '明日のステージ、ちょっと不安なんです…' },
    ],
    currentUserMessage: '大丈夫だよ。落とし物も届けたし、応援してる',
    turnsSinceLastTransition: 2,
    daysSinceEntry: 0,
  });

  assert.equal(context.topics.get('thanks_or_kindness'), 1);
  assert.equal(context.events.get('supported_after_insecurity'), true);
});

test('sandbox phase timing counts turns since the last transition into the active phase', () => {
  const timing = deriveSandboxPhaseTiming({
    sessionCreatedAt: new Date('2026-03-23T00:00:00.000Z'),
    currentPhaseId: 'cafe_thank_you',
    turns: [
      {
        createdAt: new Date('2026-03-23T00:01:00.000Z'),
        traceJson: { phaseIdBefore: 'station_meeting', phaseIdAfter: 'cafe_thank_you' },
      },
      {
        createdAt: new Date('2026-03-23T00:02:00.000Z'),
        traceJson: { phaseIdBefore: 'cafe_thank_you', phaseIdAfter: 'cafe_thank_you' },
      },
    ],
    now: new Date('2026-03-23T12:00:00.000Z'),
  });

  assert.equal(timing.turnsSinceLastTransition, 1);
  assert.equal(timing.daysSinceEntry, 0);
});

test('relationship metrics warm on reciprocal kindness and reduce conflict pressure-free', () => {
  const next = updateRelationshipMetrics({
    current: {
      affinity: 50,
      trust: 50,
      intimacyReadiness: 0,
      conflict: 10,
    },
    appraisal: {
      goalCongruence: 0.35,
      controllability: 0.5,
      certainty: 0.6,
      normAlignment: 0.2,
      attachmentSecurity: 0.65,
      reciprocity: 0.4,
      pressureIntrusiveness: 0,
      novelty: 0.5,
      selfRelevance: 0.7,
    },
    emotionBefore: { pleasure: 0.1, arousal: 0.1, dominance: 0 },
    emotionAfter: { pleasure: 0.2, arousal: 0.1, dominance: 0 },
  });

  assert.ok(next.trust > 50);
  assert.ok(next.affinity > 50);
  assert.ok(next.intimacyReadiness > 0);
  assert.ok(next.conflict < 10);
});

test('phase transition falls back to engine result when planner does not nominate a target', () => {
  const target = resolvePhaseTransition(
    {
      shouldTransition: true,
      targetPhaseId: 'cafe_thank_you',
      reason: 'kindness topic matched',
      satisfiedConditions: [],
      failedConditions: [],
    },
    null
  );

  assert.equal(target, 'cafe_thank_you');
});
