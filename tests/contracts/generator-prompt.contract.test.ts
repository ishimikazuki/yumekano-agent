/**
 * T2: Generator prompt contract test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { GeneratorOutputSchema } from '@/mastra/agents/generator';
import { seiraPrompts } from '@/lib/db/seed-seira';

const CHECKED_IN_PATH = 'prompts/conversation.system.md';
const FORBIDDEN_LEGACY = [/\b`not_now`\b/, /\b`no`\b/, /\bshouldSplit\b/];

function readPrompt(): string {
  return readFileSync(path.join(process.cwd(), CHECKED_IN_PATH), 'utf8');
}

function extractJson(prompt: string): unknown {
  const match = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(match, 'Generator prompt must include a ```json block');
  return JSON.parse(match[1]!);
}

test('T2 generator: checked-in prompt has no legacy field names', () => {
  const prompt = readPrompt();
  for (const pattern of FORBIDDEN_LEGACY) {
    assert.doesNotMatch(prompt, pattern);
  }
});

test('T2 generator: checked-in prompt JSON validates against GeneratorOutputSchema', () => {
  const prompt = readPrompt();
  GeneratorOutputSchema.parse(extractJson(prompt));
});

test('T2 generator: Seira override references active contract keys', () => {
  const prompt = seiraPrompts.generatorMd;
  for (const field of ['candidates', 'text', 'toneTags', 'memoryRefsUsed', 'riskFlags']) {
    assert.match(prompt, new RegExp(`\\b${field}\\b`), `Seira generator should reference ${field}`);
  }
});
