import { z } from 'zod';

export const PromptFragmentSchema = z
  .string()
  .default('')
  .describe('Designer-authored prompt fragment merged into the invariant runtime prompt');
export type PromptFragment = z.infer<typeof PromptFragmentSchema>;

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
  plannerMd: PromptFragmentSchema.describe('Planner designer fragment'),
  generatorMd: PromptFragmentSchema.describe('Generator designer fragment'),
  generatorIntimacyMd: PromptFragmentSchema.describe(
    'Intimacy-specific generator designer fragment'
  ),
  extractorMd: PromptFragmentSchema.describe('Memory extractor designer fragment'),
  reflectorMd: PromptFragmentSchema.describe('Reflector designer fragment'),
  rankerMd: PromptFragmentSchema.describe('Ranker designer fragment'),
  createdAt: z.coerce.date(),
});
export type PromptBundleVersion = z.infer<typeof PromptBundleVersionSchema>;
