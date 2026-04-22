/**
 * T-C unit: question-saturation scorer
 *
 * Purpose: if the assistant has been asking questions for several consecutive
 * turns AND the current candidate also asks another question, apply a penalty.
 * This is the guard rail for the "push-pull" design — questions are fine, but
 * a saturation pattern drains emotional progress.
 *
 * The scorer is deterministic (no LLM) to keep it cheap and explainable.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreQuestionSaturation } from '@/mastra/scorers/question-saturation';

const CANDIDATE_WITH_Q = {
  text: 'そうなんですね…翔さんって普段はどんなお仕事してるんですか？',
};
const CANDIDATE_WITHOUT_Q = {
  text: 'そうなんですね…わたしも似たような経験あります。気持ち分かるかも。',
};

test('T-C: no saturation when prior turns had no questions (candidate w/ Q is fine)', () => {
  const result = scoreQuestionSaturation({
    candidate: CANDIDATE_WITH_Q,
    recentDialogue: [
      { role: 'user', content: 'こんにちは' },
      { role: 'assistant', content: 'こんにちは！お話できて嬉しいです。' },
      { role: 'user', content: '今日はどうしたの' },
      { role: 'assistant', content: 'ライブ前でちょっと緊張してるんです。' },
    ],
  });
  assert.equal(result.score, 1.0, 'no saturation = full score');
  assert.equal(result.issues.length, 0);
});

test('T-C: saturation penalty when 2 prior assistant turns both asked questions and candidate also asks', () => {
  const result = scoreQuestionSaturation({
    candidate: CANDIDATE_WITH_Q,
    recentDialogue: [
      { role: 'user', content: 'うん' },
      { role: 'assistant', content: 'そうなんですね！翔さんの好きな食べ物は何ですか？' },
      { role: 'user', content: 'カレーかな' },
      { role: 'assistant', content: 'カレーいいですね！辛いのと甘いのどっちが好きですか？' },
    ],
  });
  assert.ok(result.score < 1.0, 'saturated pattern must get penalty');
  assert.ok(result.score <= 0.5, 'penalty should be substantial');
  assert.ok(
    result.issues.some((i) => /saturation|consecutive|質問/.test(i)),
    'issues must describe the saturation'
  );
});

test('T-C: candidate without question breaks the saturation chain (no penalty)', () => {
  const result = scoreQuestionSaturation({
    candidate: CANDIDATE_WITHOUT_Q,
    recentDialogue: [
      { role: 'user', content: 'うん' },
      { role: 'assistant', content: 'そうなんですね！翔さんの好きな食べ物は何ですか？' },
      { role: 'user', content: 'カレーかな' },
      { role: 'assistant', content: 'カレーいいですね！辛いのと甘いのどっちが好きですか？' },
    ],
  });
  assert.equal(result.score, 1.0, 'breaking the chain wins full score');
});

test('T-C: saturation kicks in only when window is full (1 prior Q is not enough)', () => {
  const result = scoreQuestionSaturation({
    candidate: CANDIDATE_WITH_Q,
    recentDialogue: [
      { role: 'user', content: 'こんにちは' },
      { role: 'assistant', content: 'こんにちは！今日は何されてたんですか？' },
      { role: 'user', content: '仕事' },
      { role: 'assistant', content: 'お仕事お疲れさまです！' },
    ],
  });
  assert.equal(result.score, 1.0, '1 prior Q + candidate Q does not trigger');
});

test('T-C: configurable windowTurns lowers the trigger threshold', () => {
  // Default windowTurns=3 — this dialogue (1 prior Q + candidate Q) does NOT trigger at default.
  const defaultScore = scoreQuestionSaturation({
    candidate: CANDIDATE_WITH_Q,
    recentDialogue: [
      { role: 'user', content: 'こんにちは' },
      { role: 'assistant', content: 'こんにちは！今日は何されてたんですか？' },
    ],
  });
  assert.equal(defaultScore.score, 1.0, 'baseline: default windowTurns=3 does not trigger on 2-turn streak');

  // With windowTurns=2, the same dialogue SHOULD trigger (1 prior Q + candidate Q = 2 consecutive).
  const aggressive = scoreQuestionSaturation({
    candidate: CANDIDATE_WITH_Q,
    recentDialogue: [
      { role: 'user', content: 'こんにちは' },
      { role: 'assistant', content: 'こんにちは！今日は何されてたんですか？' },
    ],
    config: { windowTurns: 2 },
  });
  assert.ok(
    aggressive.score < 1.0,
    'windowTurns=2 means any 2-turn consecutive Q run triggers saturation'
  );
});

test('T-C: handles both ？ (full-width) and ? (half-width)', () => {
  const result = scoreQuestionSaturation({
    candidate: { text: 'どんな感じ?' },
    recentDialogue: [
      { role: 'assistant', content: '今日は何してたの？' },
      { role: 'user', content: 'うん' },
      { role: 'assistant', content: 'どんな一日だった？' },
    ],
  });
  assert.ok(result.score < 1.0);
});

test('T-C: no assistant turns in dialogue = no saturation possible', () => {
  const result = scoreQuestionSaturation({
    candidate: CANDIDATE_WITH_Q,
    recentDialogue: [{ role: 'user', content: 'はじめまして' }],
  });
  assert.equal(result.score, 1.0);
});
