/**
 * T2: Ranker prompt contract test
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { RankerOutputSchema } from '@/mastra/agents/ranker';
import { seiraPrompts } from '@/lib/db/seed-seira';

const CHECKED_IN_PATH = 'prompts/ranker.system.md';
const FORBIDDEN_LEGACY = [/"globalNotes": \[/, /\b`not_now`\b/, /\b`no`\b/];

function readPrompt(): string {
  return readFileSync(path.join(process.cwd(), CHECKED_IN_PATH), 'utf8');
}

function extractJson(prompt: string): unknown {
  const match = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(match, 'Ranker prompt must include a ```json block');
  return JSON.parse(match[1]!);
}

test('T2 ranker: checked-in prompt has no legacy field names', () => {
  const prompt = readPrompt();
  for (const pattern of FORBIDDEN_LEGACY) {
    assert.doesNotMatch(prompt, pattern);
  }
});

test('T2 ranker: checked-in prompt JSON validates against RankerOutputSchema', () => {
  const prompt = readPrompt();
  RankerOutputSchema.parse(extractJson(prompt));
});

test('T2 ranker: Seira override references active contract keys', () => {
  const prompt = seiraPrompts.rankerMd;
  for (const field of ['winnerIndex', 'scorecards', 'globalNotes']) {
    assert.match(prompt, new RegExp(`\\b${field}\\b`), `Seira ranker should reference ${field}`);
  }
});
