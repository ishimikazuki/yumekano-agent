/**
 * T2: Planner prompt contract test
 *
 * Verifies checked-in planner prompt matches TurnPlanSchema
 * and contains no legacy field names.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TurnPlanSchema } from '@/lib/schemas';
import { seiraPrompts } from '@/lib/db/seed-seira';

const CHECKED_IN_PATH = 'prompts/planner.system.md';
const FORBIDDEN_LEGACY = [/\bdialogueActs\b/, /\bmustAvoidList\b/, /\b`allowed`\b/, /\b`not_now`\b/, /\b`no`\b/];

function readPrompt(): string {
  return readFileSync(path.join(process.cwd(), CHECKED_IN_PATH), 'utf8');
}

function extractJson(prompt: string): unknown {
  const match = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(match, 'Planner prompt must include a ```json block');
  return JSON.parse(match[1]!);
}

test('T2 planner: checked-in prompt has no legacy field names', () => {
  const prompt = readPrompt();
  for (const pattern of FORBIDDEN_LEGACY) {
    assert.doesNotMatch(prompt, pattern);
  }
});

test('T2 planner: checked-in prompt JSON validates against TurnPlanSchema', () => {
  const prompt = readPrompt();
  TurnPlanSchema.parse(extractJson(prompt));
});

test('T2 planner: Seira override references active contract keys', () => {
  const prompt = seiraPrompts.plannerMd;
  for (const field of ['primaryActs', 'secondaryActs', 'intimacyDecision', 'mustAvoid', 'plannerReasoning']) {
    assert.match(prompt, new RegExp(`\\b${field}\\b`), `Seira planner should reference ${field}`);
  }
});
