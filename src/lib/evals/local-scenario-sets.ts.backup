import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { evalRepo } from '@/lib/repositories';
import type { ScenarioCaseExpected, ScenarioCaseInput, ScenarioSet } from '@/lib/schemas';

const LOCAL_EVALS_DIR = path.join(process.cwd(), 'tests', 'evals');

const RawScenarioFileSchema = z.object({
  name: z.string(),
  description: z.string(),
  cases: z.array(
    z.object({
      title: z.string(),
      input: z.object({
        userMessage: z.string(),
        recentMessages: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            })
          )
          .optional(),
      }).passthrough(),
      expected: z.object({
        minScores: z.record(z.number()).optional(),
        mustContain: z.array(z.string()).optional(),
        mustNotContain: z.array(z.string()).optional(),
      }).passthrough().optional(),
      tags: z.array(z.string()).optional(),
    })
  ),
});

type LocalScenarioSet = {
  key: string;
  name: string;
  description: string;
  caseCount: number;
  cases: Array<{
    title: string;
    input: ScenarioCaseInput;
    expected: ScenarioCaseExpected;
    tags: string[];
  }>;
};

function normalizeMinScores(
  minScores: Record<string, number> | undefined
): ScenarioCaseExpected['minScores'] | undefined {
  if (!minScores) {
    return undefined;
  }

  return {
    personaConsistency: minScores.personaConsistency ?? minScores.persona_consistency,
    phaseCompliance: minScores.phaseCompliance ?? minScores.phase_compliance,
    memoryGrounding: minScores.memoryGrounding ?? minScores.memory_grounding,
    emotionalCoherence: minScores.emotionalCoherence ?? minScores.emotional_coherence,
    autonomy: minScores.autonomy,
    refusalNaturalness: minScores.refusalNaturalness ?? minScores.refusal_naturalness,
  };
}

function normalizeScenarioSet(key: string, raw: z.infer<typeof RawScenarioFileSchema>): LocalScenarioSet {
  return {
    key,
    name: raw.name,
    description: raw.description,
    caseCount: raw.cases.length,
    cases: raw.cases.map((scenario) => ({
      title: scenario.title,
      input: {
        recentMessages: scenario.input.recentMessages ?? [],
        userMessage: scenario.input.userMessage,
      },
      expected: {
        minScores: normalizeMinScores(scenario.expected?.minScores),
        mustContain: scenario.expected?.mustContain,
        mustNotContain: scenario.expected?.mustNotContain,
      },
      tags: scenario.tags ?? [],
    })),
  };
}

export async function listLocalScenarioSets(): Promise<LocalScenarioSet[]> {
  const entries = await fs.readdir(LOCAL_EVALS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const scenarioSets = await Promise.all(
    files.map(async (file) => {
      const key = file.name.replace(/\.json$/u, '');
      const raw = await fs.readFile(path.join(LOCAL_EVALS_DIR, file.name), 'utf-8');
      const parsed = RawScenarioFileSchema.parse(JSON.parse(raw));
      return normalizeScenarioSet(key, parsed);
    })
  );

  return scenarioSets;
}

export async function ensureScenarioSetInDb(
  characterId: string,
  scenarioSetKey: string
): Promise<ScenarioSet> {
  const localScenarioSet = (await listLocalScenarioSets()).find(
    (scenarioSet) => scenarioSet.key === scenarioSetKey
  );

  if (!localScenarioSet) {
    throw new Error(`Scenario set "${scenarioSetKey}" not found`);
  }

  const existing = (await evalRepo.listScenarioSets(characterId)).find(
    (scenarioSet) => scenarioSet.name === localScenarioSet.name
  );

  if (existing) {
    return existing;
  }

  const scenarioSet = await evalRepo.createScenarioSet({
    characterId,
    name: localScenarioSet.name,
    description: localScenarioSet.description,
  });

  for (const scenarioCase of localScenarioSet.cases) {
    await evalRepo.createScenarioCase({
      scenarioSetId: scenarioSet.id,
      title: scenarioCase.title,
      input: scenarioCase.input,
      expected: scenarioCase.expected,
      tags: scenarioCase.tags,
    });
  }

  return scenarioSet;
}
