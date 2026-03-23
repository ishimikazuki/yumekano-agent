import { z } from 'zod';

/**
 * Prompt bundle reference - links to versioned prompts
 */
export const PromptBundleRefSchema = z.object({
  promptBundleVersionId: z.string().uuid(),
  plannerVariant: z.string().optional(),
  generatorVariant: z.string().optional(),
  extractorVariant: z.string().optional(),
  reflectorVariant: z.string().optional(),
  rankerVariant: z.string().optional(),
});
export type PromptBundleRef = z.infer<typeof PromptBundleRefSchema>;

/**
 * Prompt bundle version - immutable prompt container
 */
export const PromptBundleVersionSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  plannerMd: z.string().describe('Planner system prompt'),
  generatorMd: z.string().describe('Generator system prompt'),
  generatorIntimacyMd: z
    .string()
    .default('')
    .describe('Intimacy-specific generator system prompt'),
  extractorMd: z.string().describe('Memory extractor system prompt'),
  reflectorMd: z.string().describe('Reflector system prompt'),
  rankerMd: z.string().describe('Ranker system prompt'),
  createdAt: z.coerce.date(),
});
export type PromptBundleVersion = z.infer<typeof PromptBundleVersionSchema>;
