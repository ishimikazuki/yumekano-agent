import { z } from 'zod';

/**
 * Scenario set - collection of test cases
 */
export const ScenarioSetSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
});
export type ScenarioSet = z.infer<typeof ScenarioSetSchema>;

/**
 * Scenario case input
 */
export const ScenarioCaseInputSchema = z.object({
  pairState: z.object({
    phaseId: z.string(),
    affinity: z.number(),
    trust: z.number(),
    intimacyReadiness: z.number(),
    conflict: z.number(),
  }).optional(),
  recentMessages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  userMessage: z.string(),
  workingMemory: z.unknown().optional(),
  injectedEvents: z.array(z.unknown()).optional(),
  injectedFacts: z.array(z.unknown()).optional(),
  injectedThreads: z.array(z.unknown()).optional(),
});
export type ScenarioCaseInput = z.infer<typeof ScenarioCaseInputSchema>;

/**
 * Scenario case expected output
 */
export const ScenarioCaseExpectedSchema = z.object({
  minScores: z.object({
    personaConsistency: z.number().optional(),
    phaseCompliance: z.number().optional(),
    memoryGrounding: z.number().optional(),
    emotionalCoherence: z.number().optional(),
    autonomy: z.number().optional(),
    refusalNaturalness: z.number().optional(),
  }).optional(),
  mustContain: z.array(z.string()).optional(),
  mustNotContain: z.array(z.string()).optional(),
  expectedActs: z.array(z.string()).optional(),
  forbiddenActs: z.array(z.string()).optional(),
});
export type ScenarioCaseExpected = z.infer<typeof ScenarioCaseExpectedSchema>;

/**
 * Scenario case - single test case
 */
export const ScenarioCaseSchema = z.object({
  id: z.string().uuid(),
  scenarioSetId: z.string().uuid(),
  title: z.string(),
  input: ScenarioCaseInputSchema,
  expected: ScenarioCaseExpectedSchema,
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
});
export type ScenarioCase = z.infer<typeof ScenarioCaseSchema>;

/**
 * Eval run status
 */
export const EvalRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type EvalRunStatus = z.infer<typeof EvalRunStatusSchema>;

/**
 * Eval run - single evaluation execution
 */
export const EvalRunSchema = z.object({
  id: z.string().uuid(),
  scenarioSetId: z.string().uuid(),
  characterVersionId: z.string().uuid(),
  modelRegistrySnapshot: z.unknown().describe('Snapshot of model config at run time'),
  status: EvalRunStatusSchema,
  summary: z.object({
    totalCases: z.number().int(),
    passedCases: z.number().int(),
    failedCases: z.number().int(),
    averageScores: z.record(z.string(), z.number()),
  }).nullable(),
  createdAt: z.coerce.date(),
});
export type EvalRun = z.infer<typeof EvalRunSchema>;

/**
 * Eval case result - result for single case
 */
export const EvalCaseResultSchema = z.object({
  id: z.string().uuid(),
  evalRunId: z.string().uuid(),
  scenarioCaseId: z.string().uuid(),
  scores: z.record(z.string(), z.number()),
  passed: z.boolean(),
  failureReasons: z.array(z.string()),
  traceId: z.string().uuid(),
  createdAt: z.coerce.date(),
});
export type EvalCaseResult = z.infer<typeof EvalCaseResultSchema>;
