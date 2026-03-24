import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeneratorSystemPrompt,
  selectGeneratorPrompt,
} from '@/mastra/agents/generator';
import { buildPlannerSystemPrompt } from '@/mastra/agents/planner';
import {
  createCharacterVersion,
  createEmotion,
  createPairState,
  createPhaseNode,
  createPlan,
  createRawCharacterVersion,
  createWorkingMemory,
} from './persona-test-helpers';

test('planner prefers compiledPersona and keeps prompt bundle text as a prelude', () => {
  const prompt = buildPlannerSystemPrompt({
    characterVersion: createCharacterVersion(),
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    emotion: createEmotion(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: {
      events: [],
      facts: [],
      observations: [],
      threads: [],
    },
    recentDialogue: [],
    userMessage: 'ただいま',
    promptOverride: 'CUSTOM PLANNER PRELUDE',
  });

  assert.match(prompt, /# Planner System Prompt/);
  assert.match(prompt, /## Designer Instructions\nCUSTOM PLANNER PRELUDE/);
  assert.match(prompt, /## Compiled Persona/);
  assert.match(prompt, /One-Line Core: 選ばれたいが、傷つく前に軽口で距離を作る子。/);
  assert.equal(prompt.includes('## Persona Summary'), false);
});

test('planner falls back to raw persona fields when compiledPersona is missing', () => {
  const prompt = buildPlannerSystemPrompt({
    characterVersion: createRawCharacterVersion(),
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    emotion: createEmotion(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: {
      events: [],
      facts: [],
      observations: [],
      threads: [],
    },
    recentDialogue: [],
    userMessage: 'ただいま',
  });

  assert.match(prompt, /## Persona Summary/);
  assert.match(prompt, /Inner World Note: 望み: 選ばれたい/);
  assert.match(prompt, /### Vulnerabilities/);
  assert.equal(prompt.includes('## Compiled Persona'), false);
});

test('generator prefers compiledPersona, keeps authoredExamples, and preserves intimacy prompt as a prelude', () => {
  const promptOverride = selectGeneratorPrompt(
    {
      generatorMd: 'DEFAULT GENERATOR PRELUDE',
      generatorIntimacyMd: 'INTIMACY GENERATOR PRELUDE',
    },
    {
      ...createPlan(),
      intimacyDecision: 'conditional_accept',
    }
  );

  const prompt = buildGeneratorSystemPrompt({
    characterVersion: createCharacterVersion(),
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    emotion: createEmotion(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: {
      events: [],
      facts: [],
      observations: [],
      threads: [],
    },
    recentDialogue: [],
    userMessage: 'もう少し近くに来て',
    plan: {
      ...createPlan(),
      intimacyDecision: 'conditional_accept',
    },
    promptOverride,
  });

  assert.match(prompt, /# Conversation Generator System Prompt/);
  assert.match(prompt, /## Designer Instructions\nINTIMACY GENERATOR PRELUDE/);
  assert.match(prompt, /One-Line Core: 選ばれたいが、傷つく前に軽口で距離を作る子。/);
  assert.match(prompt, /### Tone Hints/);
  assert.match(prompt, /\[warm\] ちゃんと見てくれるの、うれしいよ/);
  assert.match(prompt, /\[guarded\] 別に、気にしてないし/);
});

test('generator falls back to raw persona fields when compiledPersona is missing', () => {
  const prompt = buildGeneratorSystemPrompt({
    characterVersion: createRawCharacterVersion(),
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    emotion: createEmotion(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: {
      events: [],
      facts: [],
      observations: [],
      threads: [],
    },
    recentDialogue: [],
    userMessage: 'どうしたの？',
    plan: createPlan(),
    promptOverride: 'DEFAULT GENERATOR PRELUDE',
  });

  assert.match(prompt, /# Conversation Generator System Prompt/);
  assert.match(prompt, /## Designer Instructions\nDEFAULT GENERATOR PRELUDE/);
  assert.match(prompt, /- Summary: 甘えたいけど、傷つく前に軽口で距離を取る子。/);
  assert.match(prompt, /### Vulnerabilities/);
  assert.equal(prompt.includes('One-Line Core:'), false);
});
