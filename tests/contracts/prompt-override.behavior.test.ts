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
    { intimacyDecision: 'not_applicable' as const, stance: 'neutral' as const, primaryActs: [], secondaryActs: [], mustAvoid: [], memoryFocus: { emphasize: [], suppress: [], reason: '' }, phaseTransitionProposal: { shouldTransition: false as const, targetPhaseId: null, reason: '' }, emotionDeltaIntent: { pleasureDelta: 0, arousalDelta: 0, dominanceDelta: 0, reason: '' }, plannerReasoning: '' }
  );
  assert.equal(result, 'main prompt');
});

test('T2 prompt-override: selectGeneratorPrompt returns intimacyMd when intimacy is accepted', () => {
  const result = selectGeneratorPrompt(
    { generatorMd: 'main prompt', generatorIntimacyMd: 'intimacy prompt' },
    { intimacyDecision: 'accept' as const, stance: 'neutral' as const, primaryActs: [], secondaryActs: [], mustAvoid: [], memoryFocus: { emphasize: [], suppress: [], reason: '' }, phaseTransitionProposal: { shouldTransition: false as const, targetPhaseId: null, reason: '' }, emotionDeltaIntent: { pleasureDelta: 0, arousalDelta: 0, dominanceDelta: 0, reason: '' }, plannerReasoning: '' }
  );
  assert.equal(result, 'intimacy prompt');
});

test('T2 prompt-override: selectGeneratorPrompt falls back to generatorMd if intimacyMd is empty', () => {
  const result = selectGeneratorPrompt(
    { generatorMd: 'main prompt', generatorIntimacyMd: '' },
    { intimacyDecision: 'accept' as const, stance: 'neutral' as const, primaryActs: [], secondaryActs: [], mustAvoid: [], memoryFocus: { emphasize: [], suppress: [], reason: '' }, phaseTransitionProposal: { shouldTransition: false as const, targetPhaseId: null, reason: '' }, emotionDeltaIntent: { pleasureDelta: 0, arousalDelta: 0, dominanceDelta: 0, reason: '' }, plannerReasoning: '' }
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

test('T2 prompt-override: all agents use formatDesignerFragment (not raw assignment)', () => {
  const agentFiles = [
    'src/mastra/agents/planner.ts',
    'src/mastra/agents/generator.ts',
    'src/mastra/agents/ranker.ts',
    'src/mastra/agents/coe-evidence-extractor.ts',
    'src/mastra/agents/memory-extractor.ts',
  ];
  for (const file of agentFiles) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.match(
      source,
      /formatDesignerFragment\(promptOverride\)/,
      `${file} must use formatDesignerFragment(promptOverride), not raw assignment`
    );
  }
});

test('T2 prompt-override: mandatory rules survive after designer fragment injection', () => {
  // Generator: mandatory rules come after formatDesignerFragment
  const generatorSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/agents/generator.ts'),
    'utf8'
  );
  const fragmentIndex = generatorSource.indexOf('formatDesignerFragment(promptOverride)');
  const rulesIndex = generatorSource.indexOf('## Rules', fragmentIndex);
  assert.ok(fragmentIndex > 0, 'Generator should have formatDesignerFragment');
  assert.ok(rulesIndex > fragmentIndex, 'Generator mandatory rules must come AFTER designer fragment');

  // Planner: same pattern
  const plannerSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/agents/planner.ts'),
    'utf8'
  );
  const pFragmentIndex = plannerSource.indexOf('formatDesignerFragment(promptOverride)');
  const pRulesIndex = plannerSource.indexOf('## Rules', pFragmentIndex);
  assert.ok(pFragmentIndex > 0, 'Planner should have formatDesignerFragment');
  assert.ok(pRulesIndex > pFragmentIndex, 'Planner mandatory rules must come AFTER designer fragment');
});

test('T2 prompt-override: prod and draft use same prompt path via executeTurn', () => {
  const draftSource = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  // Draft should pass promptBundle to executeTurn
  assert.match(draftSource, /promptBundle/, 'Draft must pass promptBundle');
  // Draft should NOT have its own agent calls — it uses executeTurn
  assert.doesNotMatch(draftSource, /runPlanner\(/, 'Draft must not call planner directly');
  assert.doesNotMatch(draftSource, /runGenerator\(/, 'Draft must not call generator directly');
  assert.doesNotMatch(draftSource, /runRanker\(/, 'Draft must not call ranker directly');
});
