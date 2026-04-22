/**
 * T-D: planner push-pull prompt integration
 *
 * Verifies the planner system prompt carries the push-pull / vertical
 * progression guidance when a phase expects it, and that seira's
 * authoredExamples carry at least 3 push-pull patterns.
 *
 * We assert on the prompt content (not live LLM output) because ci:local
 * runs offline.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlannerSystemPrompt } from '@/mastra/agents/planner';
import { seiraPersona } from '@/lib/db/seed-seira';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createWorkingMemory,
} from '../persona-test-helpers';
import type { PlannerInput } from '@/mastra/agents/planner';

function buildPlannerInput(): PlannerInput {
  const characterVersion = createCharacterVersion();
  const phase = {
    ...createPhaseNode(),
    allowedActs: [
      'share_information',
      'ask_question',
      'self_disclose',
      'show_vulnerability',
      'suggest',
    ] as any,
  };
  const pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: phase.id,
  });
  return {
    characterVersion,
    currentPhase: phase,
    pairState,
    emotion: pairState.emotion.combined,
    workingMemory: createWorkingMemory(),
    retrievedMemory: { events: [], facts: [], observations: [], threads: [] },
    userMessage: '最近どう？',
    recentDialogue: [],
    turnsSinceLastTransition: 1,
    daysSinceEntry: 1,
    turnsSinceLastEmotionUpdate: 1,
  } as unknown as PlannerInput;
}

test('planner system prompt explains push-pull / vertical progression', () => {
  const systemPrompt = buildPlannerSystemPrompt(buildPlannerInput());

  assert.ok(
    /push.?pull|押して引く/i.test(systemPrompt),
    'system prompt must surface the push-pull concept'
  );
  assert.ok(
    /self_disclose/.test(systemPrompt),
    'system prompt must still describe self_disclose'
  );
  assert.ok(
    /show_vulnerability/.test(systemPrompt),
    'system prompt must still describe show_vulnerability'
  );
});

test('planner prompt suggests dominance-delta negative as a "引く" move', () => {
  const systemPrompt = buildPlannerSystemPrompt(buildPlannerInput());
  assert.ok(
    /dominance|D[\s_-]?delta/i.test(systemPrompt),
    'prompt must mention the dominance / D-delta guidance'
  );
});

test('seira persona authored examples include 3+ push-pull patterns (weakness reveal + invite)', () => {
  const warmCount = (seiraPersona.authoredExamples?.warm ?? []).length;
  const guardedCount = (seiraPersona.authoredExamples?.guarded ?? []).length;
  const combined = warmCount + guardedCount;

  assert.ok(
    combined >= 3,
    `seira should carry >= 3 authored examples across warm+guarded for push-pull patterns (got ${combined})`
  );
});
