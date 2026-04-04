/**
 * T4: CoE extractor mocked test
 *
 * Verifies the extractor module exists, is importable, and its prompt builders
 * include required semantic inputs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoEEvidenceExtractorSystemPrompt,
  buildCoEEvidenceExtractorUserPrompt,
  runCoEEvidenceExtractor,
} from '@/mastra/agents/coe-evidence-extractor';
import { createPhaseNode, createPairState, createWorkingMemory } from '../persona-test-helpers';

test('T4 CoE extractor module is importable', () => {
  assert.equal(typeof runCoEEvidenceExtractor, 'function');
  assert.equal(typeof buildCoEEvidenceExtractorSystemPrompt, 'function');
  assert.equal(typeof buildCoEEvidenceExtractorUserPrompt, 'function');
});

test('T4 CoE extractor system prompt mentions structured analyzer role', () => {
  const input = {
    userMessage: 'テスト',
    recentDialogue: [],
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: { facts: [], events: [], observations: [], threads: [] },
    openThreads: [],
  };
  const prompt = buildCoEEvidenceExtractorSystemPrompt(input);
  assert.match(prompt, /structured semantic analyzer/i);
});

test('T4 CoE extractor user prompt includes all required sections', () => {
  const input = {
    userMessage: '今日すごく可愛いね',
    recentDialogue: [{ role: 'assistant' as const, content: 'ありがとう' }],
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: { facts: [], events: [], observations: [], threads: [] },
    openThreads: [],
  };
  const prompt = buildCoEEvidenceExtractorUserPrompt(input);
  assert.match(prompt, /## User Message/);
  assert.match(prompt, /## Current Phase/);
  assert.match(prompt, /## Pair State/);
});
