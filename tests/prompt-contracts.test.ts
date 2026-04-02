import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TurnPlanSchema } from '@/lib/schemas';
import { GeneratorOutputSchema } from '@/mastra/agents/generator';
import { RankerOutputSchema } from '@/mastra/agents/ranker';
import { seiraPrompts } from '@/lib/db/seed-seira';

type PromptFamily = 'planner' | 'generator' | 'ranker';

const CANONICAL_PROMPT_CONTRACT = {
  planner: {
    schema: TurnPlanSchema,
    checkedInPath: 'prompts/planner.system.md',
    seedVariable: 'plannerPrompt',
    seiraPrompt: () => seiraPrompts.plannerMd,
    requiredSeiraFields: [
      'primaryActs',
      'secondaryActs',
      'intimacyDecision',
      'mustAvoid',
      'plannerReasoning',
    ],
    forbiddenLegacyPatterns: [
      /\bdialogueActs\b/,
      /\bmustAvoidList\b/,
      /\b`allowed`\b/,
      /\b`not_now`\b/,
      /\b`no`\b/,
    ],
  },
  generator: {
    schema: GeneratorOutputSchema,
    checkedInPath: 'prompts/conversation.system.md',
    seedVariable: 'generatorPrompt',
    seiraPrompt: () => seiraPrompts.generatorMd,
    requiredSeiraFields: ['candidates', 'text', 'toneTags', 'memoryRefsUsed', 'riskFlags'],
    forbiddenLegacyPatterns: [/\b`not_now`\b/, /\b`no`\b/, /\bshouldSplit\b/],
  },
  ranker: {
    schema: RankerOutputSchema,
    checkedInPath: 'prompts/ranker.system.md',
    seedVariable: 'rankerPrompt',
    seiraPrompt: () => seiraPrompts.rankerMd,
    requiredSeiraFields: ['winnerIndex', 'scorecards', 'globalNotes'],
    forbiddenLegacyPatterns: [/"globalNotes": \[/, /\b`not_now`\b/, /\b`no`\b/],
  },
} as const;

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function extractSeedPromptBlock(source: string, variableName: string): string {
  const pattern = new RegExp(`const\\s+${variableName}\\s*=\\s*\\\`([\\s\\S]*?)\\\`;`);
  const match = source.match(pattern);
  assert.ok(match, `Could not find ${variableName} in src/lib/db/seed.ts`);
  return match[1]!.replace(/\\`/g, '`');
}

function extractJsonCodeBlock(prompt: string): unknown {
  const match = prompt.match(/```json\s*([\s\S]*?)```/);
  assert.ok(match, 'Prompt must include a ```json block for contract validation');
  return JSON.parse(match[1]!);
}

function assertNoLegacyPatterns(text: string, patterns: readonly RegExp[]) {
  for (const pattern of patterns) {
    assert.doesNotMatch(text, pattern);
  }
}

for (const family of Object.keys(CANONICAL_PROMPT_CONTRACT) as PromptFamily[]) {
  const contract = CANONICAL_PROMPT_CONTRACT[family];

  test(`${family}: checked-in prompt JSON example satisfies canonical schema`, () => {
    const prompt = readProjectFile(contract.checkedInPath);
    assertNoLegacyPatterns(prompt, contract.forbiddenLegacyPatterns);
    contract.schema.parse(extractJsonCodeBlock(prompt));
  });

  test(`${family}: seed prompt JSON example satisfies canonical schema`, () => {
    const seedSource = readProjectFile('src/lib/db/seed.ts');
    const prompt = extractSeedPromptBlock(seedSource, contract.seedVariable);
    assertNoLegacyPatterns(prompt, contract.forbiddenLegacyPatterns);
    contract.schema.parse(extractJsonCodeBlock(prompt));
  });

  test(`${family}: Seira override avoids legacy fields and references active contract keys`, () => {
    const seiraPrompt = contract.seiraPrompt();
    assertNoLegacyPatterns(seiraPrompt, contract.forbiddenLegacyPatterns);
    for (const field of contract.requiredSeiraFields) {
      assert.match(seiraPrompt, new RegExp(`\\b${field}\\b`));
    }
  });
}
