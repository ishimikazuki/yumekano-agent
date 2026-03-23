import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlaygroundTurn } from '@/lib/schemas';
import { restorePlaygroundMessages } from '@/lib/workspaces/playground-history';
import {
  createEmotion,
  createPlan,
} from './persona-test-helpers';

test('restorePlaygroundMessages rebuilds user/assistant history with trace metadata', () => {
  const turns: PlaygroundTurn[] = [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userMessageText: 'おはよう',
      assistantMessageText: 'おはよう。ちゃんと起きられたんだ？',
      traceJson: {
        workspaceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        phaseIdBefore: 'entry',
        phaseIdAfter: 'entry',
        emotionBefore: createEmotion(),
        emotionAfter: {
          pleasure: 0.24,
          arousal: 0.15,
          dominance: -0.04,
        },
        appraisal: {
          goalCongruence: 0.4,
          controllability: 0.5,
          certainty: 0.5,
          normAlignment: 0.1,
          attachmentSecurity: 0.3,
          reciprocity: 0.2,
          pressureIntrusiveness: 0,
          novelty: 0.2,
          selfRelevance: 0.7,
        },
        plan: createPlan(),
        candidates: [
          {
            text: 'おはよう。ちゃんと起きられたんだ？',
            scores: {
              total: 0.91,
            },
          },
        ],
        winnerIndex: 0,
        userMessage: 'おはよう',
        assistantMessage: 'おはよう。ちゃんと起きられたんだ？',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z'),
    },
  ];

  const messages = restorePlaygroundMessages(turns);

  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], {
    role: 'user',
    content: 'おはよう',
  });
  assert.equal(messages[1].role, 'assistant');
  assert.equal(messages[1].content, 'おはよう。ちゃんと起きられたんだ？');
  assert.equal(messages[1].turnId, turns[0].id);
  assert.equal(messages[1].phaseId, 'entry');
  assert.equal(messages[1].emotion?.pleasure, 0.24);
  assert.ok(messages[1].coe);
  assert.match(messages[1].coe!.summary, /PAD/);
});

test('restorePlaygroundMessages falls back gracefully when traceJson is not parseable', () => {
  const turns: PlaygroundTurn[] = [
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      sessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      userMessageText: 'ただいま',
      assistantMessageText: 'おかえり',
      traceJson: {
        invalid: true,
      },
      createdAt: new Date('2026-03-23T11:00:00.000Z'),
    },
  ];

  const messages = restorePlaygroundMessages(turns);

  assert.equal(messages.length, 2);
  assert.deepEqual(messages[1], {
    role: 'assistant',
    content: 'おかえり',
    turnId: turns[0].id,
  });
});
