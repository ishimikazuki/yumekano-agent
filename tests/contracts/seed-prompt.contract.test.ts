/**
 * T2: Seed prompt contract test
 *
 * Verifies that seed prompts match runtime schemas.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TurnPlanSchema } from '@/lib/schemas';
import { GeneratorOutputSchema } from '@/mastra/agents/generator';
import { RankerOutputSchema } from '@/mastra/agents/ranker';

function readSeedSource(): string {
  return readFileSync(path.join(process.cwd(), 'src/lib/db/seed.ts'), 'utf8');
}

function extractSeedPromptBlock(source: string, variableName: string): string {
  const pattern = new RegExp(`const\\s+${variableName}\\s*=\\s*\\\`([\\s\\S]*?)\\\`;`);
  const match = source.match(pattern);
  assert.ok(match, `Could not find ${variableName} in seed.ts`);
  return match[1]!.replace(/\\`/g, '`');
}

function extractJson(prompt: string): unknown {
  const match = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(match, 'Seed prompt must include a ```json block');
  return JSON.parse(match[1]!);
}

test('T2 seed: planner seed prompt validates against TurnPlanSchema', () => {
  const source = readSeedSource();
  const prompt = extractSeedPromptBlock(source, 'plannerPrompt');
  TurnPlanSchema.parse(extractJson(prompt));
});

test('T2 seed: generator seed prompt validates against GeneratorOutputSchema', () => {
  const source = readSeedSource();
  const prompt = extractSeedPromptBlock(source, 'generatorPrompt');
  GeneratorOutputSchema.parse(extractJson(prompt));
});

test('T2 seed: ranker seed prompt validates against RankerOutputSchema', () => {
  const source = readSeedSource();
  const prompt = extractSeedPromptBlock(source, 'rankerPrompt');
  RankerOutputSchema.parse(extractJson(prompt));
});
