import assert from 'node:assert/strict';
import test from 'node:test';
import { EmotionNarrativeSchema } from '@/lib/schemas/narrative';

test('EmotionNarrativeSchema accepts valid narrative', () => {
  const valid = {
    characterNarrative: 'ユーザーの素直な愛情表現を受けて、快感情が上昇した。',
    relationshipNarrative: '信頼が微増し、親密さへの準備度が前進した。',
    drivers: ['素直な愛情表現 → 快感情 +0.23'],
  };
  const result = EmotionNarrativeSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test('EmotionNarrativeSchema rejects empty characterNarrative', () => {
  const invalid = {
    characterNarrative: '',
    relationshipNarrative: '信頼が微増。',
    drivers: ['driver'],
  };
  const result = EmotionNarrativeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('EmotionNarrativeSchema rejects empty drivers array', () => {
  const invalid = {
    characterNarrative: 'some text',
    relationshipNarrative: 'some text',
    drivers: [],
  };
  const result = EmotionNarrativeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('EmotionNarrativeSchema rejects more than 3 drivers', () => {
  const invalid = {
    characterNarrative: 'some text',
    relationshipNarrative: 'some text',
    drivers: ['a', 'b', 'c', 'd'],
  };
  const result = EmotionNarrativeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});
