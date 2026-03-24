import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TurnPlanSchema } from '@/lib/schemas';
import { GeneratorOutputSchema } from '@/mastra/agents/generator';
import { RankerOutputSchema } from '@/mastra/agents/ranker';

test('prompt markdown examples stay aligned with canonical schema keys', () => {
  const plannerPrompt = readFileSync(path.join(process.cwd(), 'prompts/planner.system.md'), 'utf8');
  const generatorPrompt = readFileSync(
    path.join(process.cwd(), 'prompts/conversation.system.md'),
    'utf8'
  );
  const rankerPrompt = readFileSync(path.join(process.cwd(), 'prompts/ranker.system.md'), 'utf8');

  assert.match(plannerPrompt, /"primaryActs"/);
  assert.doesNotMatch(plannerPrompt, /"dialogueActs"/);
  assert.match(generatorPrompt, /"candidates"/);
  assert.doesNotMatch(generatorPrompt, /"shouldSplit"/);
  assert.match(rankerPrompt, /"globalNotes": "/);
  assert.doesNotMatch(rankerPrompt, /"globalNotes": \[/);
});

test('planner example object satisfies TurnPlanSchema', () => {
  const plan = TurnPlanSchema.parse({
    stance: 'playful',
    primaryActs: ['acknowledge', 'ask_question'],
    secondaryActs: ['tease'],
    memoryFocus: {
      emphasize: [],
      suppress: [],
      reason: '相手の前向きな流れを会話に残すため',
    },
    phaseTransitionProposal: {
      shouldTransition: false,
      targetPhaseId: null,
      reason: 'まだ同じフェーズで十分だから',
    },
    intimacyDecision: 'not_applicable',
    emotionDeltaIntent: {
      pleasureDelta: 0.05,
      arousalDelta: 0.02,
      dominanceDelta: 0,
      reason: '空気を少し柔らかくするため',
    },
    mustAvoid: ['急に甘くなりすぎる'],
    plannerReasoning: '彼女は軽く受け止めつつ、質問で会話を前に進める。',
  });

  assert.equal(plan.primaryActs[0], 'acknowledge');
});

test('generator example object satisfies GeneratorOutputSchema', () => {
  const output = GeneratorOutputSchema.parse({
    candidates: [
      {
        text: 'ちゃんと気にしてくれたの、嬉しいよ。ありがと。で、今日はどうしたの？',
        toneTags: ['warm', 'playful'],
        memoryRefsUsed: ['fact:preferred_address'],
        riskFlags: [],
      },
      {
        text: 'そういうの、ちょっと安心する。ありがとね。じゃあ、続き聞かせて？',
        toneTags: ['warm', 'curious'],
        memoryRefsUsed: [],
        riskFlags: [],
      },
      {
        text: 'ふふ、そこまで見てくれるんだ。じゃあ少しだけ甘えてもいい？ 今日は何があったの？',
        toneTags: ['playful', 'soft'],
        memoryRefsUsed: ['event:last_kind_turn'],
        riskFlags: [],
      },
    ],
  });

  assert.equal(output.candidates.length, 3);
});

test('ranker example object satisfies RankerOutputSchema', () => {
  const output = RankerOutputSchema.parse({
    winnerIndex: 0,
    scorecards: [
      {
        index: 0,
        personaConsistency: 0.9,
        phaseCompliance: 0.95,
        memoryGrounding: 0.8,
        emotionalCoherence: 0.88,
        autonomy: 0.82,
        naturalness: 0.9,
        overall: 0.89,
        rejected: false,
        rejectionReason: null,
        notes: '一番自然で、今の距離感を崩さない。',
      },
    ],
    globalNotes: '候補0が最も自然で、フェーズ逸脱もない。',
  });

  assert.equal(output.globalNotes.includes('候補0'), true);
});
