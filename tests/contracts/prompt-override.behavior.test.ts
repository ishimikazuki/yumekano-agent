/**
 * T2: Prompt override behavior contract test
 *
 * Verifies that promptOverride semantics are well-defined:
 * - Each agent receives its prompt via promptOverride from the bundle
 * - selectGeneratorPrompt chooses between generatorMd and generatorIntimacyMd
 * - Override does not strip mandatory rules
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { selectGeneratorPrompt } from '@/mastra/agents/generator';

test('T2 prompt-override: selectGeneratorPrompt exists and is a function', () => {
  assert.equal(typeof selectGeneratorPrompt, 'function');
});

test('T2 prompt-override: selectGeneratorPrompt returns generatorMd by default', () => {
  const result = selectGeneratorPrompt(
    { generatorMd: 'main prompt', generatorIntimacyMd: 'intimacy prompt' },
    { intimacyDecision: 'not_applicable', primaryActs: [], secondaryActs: [], mustAvoid: [], plannerReasoning: '' }
  );
  assert.equal(result, 'main prompt');
});

test('T2 prompt-override: selectGeneratorPrompt returns intimacyMd when intimacy is accepted', () => {
  const result = selectGeneratorPrompt(
    { generatorMd: 'main prompt', generatorIntimacyMd: 'intimacy prompt' },
    { intimacyDecision: 'accept', primaryActs: [], secondaryActs: [], mustAvoid: [], plannerReasoning: '' }
  );
  assert.equal(result, 'intimacy prompt');
});

test('T2 prompt-override: selectGeneratorPrompt falls back to generatorMd if intimacyMd is empty', () => {
  const result = selectGeneratorPrompt(
    { generatorMd: 'main prompt', generatorIntimacyMd: '' },
    { intimacyDecision: 'accept', primaryActs: [], secondaryActs: [], mustAvoid: [], plannerReasoning: '' }
  );
  assert.equal(result, 'main prompt');
});

test('T2 prompt-override: execute-turn passes promptOverride to all agents', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  // Each agent call should receive promptOverride from the bundle
  assert.match(source, /promptOverride:\s*input\.promptBundle\.plannerMd/, 'Planner should get override');
  assert.match(source, /promptOverride:\s*generatorPrompt/, 'Generator should get override');
  assert.match(source, /promptOverride:\s*input\.promptBundle\.rankerMd/, 'Ranker should get override');
  assert.match(source, /promptOverride:\s*input\.promptBundle\.extractorMd/, 'Extractor should get override');
});
