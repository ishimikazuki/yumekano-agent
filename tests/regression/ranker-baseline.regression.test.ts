/**
 * T-C regression: adding question-saturation scorer must not change the
 * existing ranker baseline when no saturation is present.
 *
 * Invariants:
 * - When candidate contains no question OR no prior streak exists, saturation
 *   score = 1.0 (multiplicative no-op), so deterministicOverall equals the
 *   previous weighted aggregate.
 * - All previously-used scorer calls remain in the ranker (no silent removal).
 * - Weight calculation itself is unchanged (still uses calculateWeightedScore).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scoreQuestionSaturation } from '@/mastra/scorers/question-saturation';

const RANKER_SRC = readFileSync(
  resolve(process.cwd(), 'src/mastra/agents/ranker.ts'),
  'utf8'
);

test('T-C regression: ranker still calls every pre-T-C scorer', () => {
  const requiredScorers = [
    'scorePersonaConsistency',
    'scorePhaseCompliance',
    'scoreAutonomy',
    'scoreEmotionalCoherence',
    'scoreMemoryGrounding',
    'scoreRefusalNaturalness',
    'scoreContradictionPenalty',
  ];
  for (const scorer of requiredScorers) {
    assert.ok(
      RANKER_SRC.includes(`${scorer}(`),
      `ranker must still call ${scorer}`
    );
  }
});

test('T-C regression: weighted score still uses calculateWeightedScore with all pre-T-C fields', () => {
  assert.match(RANKER_SRC, /calculateWeightedScore\s*\(/);
  // The weighted aggregate object should still include all 7 pre-T-C fields
  const weightedCallBlock = RANKER_SRC.match(
    /calculateWeightedScore\s*\(\s*\{[\s\S]*?\}\s*,\s*weights\s*\)/
  );
  assert.ok(weightedCallBlock, 'calculateWeightedScore call block found');
  const fields = [
    'personaConsistency',
    'phaseCompliance',
    'memoryGrounding',
    'emotionalCoherence',
    'autonomy',
    'refusalNaturalness',
    'contradictionPenalty',
  ];
  for (const field of fields) {
    assert.ok(
      weightedCallBlock![0].includes(field),
      `${field} must remain in the weighted aggregate`
    );
  }
});

test('T-C regression: saturation no-op when candidate has no question — score equals 1.0', () => {
  const result = scoreQuestionSaturation({
    candidate: { text: 'そうなんですね、気持ち分かる気がします。' },
    recentDialogue: [
      { role: 'user', content: 'なんか最近疲れる' },
      { role: 'assistant', content: '大変でしたね、お疲れさまです！' },
      { role: 'user', content: 'うん' },
      { role: 'assistant', content: '今日はゆっくり休んでくださいね。' },
    ],
  });
  assert.equal(result.score, 1.0);
  assert.equal(result.issues.length, 0);
});

test('T-C regression: saturation no-op when window not filled — score equals 1.0', () => {
  const result = scoreQuestionSaturation({
    candidate: { text: '翔さんの好きな食べ物は何ですか？' },
    recentDialogue: [
      { role: 'user', content: 'こんにちは' },
      { role: 'assistant', content: 'こんにちは、お話できて嬉しいです。' },
      { role: 'user', content: 'うん' },
      { role: 'assistant', content: '今日は何か楽しいことありましたか？' },
    ],
  });
  assert.equal(result.score, 1.0, 'only 1 prior Q + candidate Q = 2 consecutive, below default threshold 3');
});

test('T-C regression: attenuation is strictly multiplicative (1.0 means no change to baseOverall)', () => {
  // Sanity: confirm the structural pattern in ranker.ts
  assert.match(
    RANKER_SRC,
    /baseOverall\s*\*\s*questionSaturationResult\.score/
  );
  // And the mathematical property: 1.0 multiplier is a no-op. Verified via the
  // helper itself in both "no question" and "window not filled" cases above.
  const noOp = scoreQuestionSaturation({
    candidate: { text: 'そうですね。' },
    recentDialogue: [],
  });
  const baseOverall = 0.8234;
  assert.equal(baseOverall * noOp.score, baseOverall);
});
