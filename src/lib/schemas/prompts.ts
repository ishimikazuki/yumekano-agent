import { z } from 'zod';

export const PromptFragmentSchema = z
  .string()
  .default('')
  .describe('Designer-authored prompt fragment merged into the invariant runtime prompt');
export type PromptFragment = z.infer<typeof PromptFragmentSchema>;

const PromptBundleFieldShape = {
  plannerMd: PromptFragmentSchema.describe('Planner designer fragment'),
  generatorMd: PromptFragmentSchema.describe('Generator designer fragment'),
  generatorIntimacyMd: PromptFragmentSchema.describe(
    'Intimacy-specific generator designer fragment'
  ),
  emotionAppraiserMd: PromptFragmentSchema.describe(
    'Emotion appraiser designer fragment'
  ),
  extractorMd: PromptFragmentSchema.describe('Memory extractor designer fragment'),
  reflectorMd: PromptFragmentSchema.describe('Reflector designer fragment'),
  rankerMd: PromptFragmentSchema.describe('Ranker designer fragment'),
} satisfies Record<string, z.ZodType<PromptFragment>>;

export const PromptBundleContentSchema = z.object(PromptBundleFieldShape);
export type PromptBundleContent = z.infer<typeof PromptBundleContentSchema>;

export const PromptBundleKeySchema = z.enum([
  'plannerMd',
  'generatorMd',
  'generatorIntimacyMd',
  'emotionAppraiserMd',
  'extractorMd',
  'reflectorMd',
  'rankerMd',
]);
export type PromptBundleKey = z.infer<typeof PromptBundleKeySchema>;

export function buildPromptBundleContent(
  input: Partial<PromptBundleContent> = {}
): PromptBundleContent {
  return PromptBundleContentSchema.parse(input);
}

/**
 * Prompt bundle reference - links to versioned prompts
 */
export const PromptBundleRefSchema = z.object({
  promptBundleVersionId: z.string().uuid(),
  plannerVariant: z.string().optional(),
  generatorVariant: z.string().optional(),
  emotionAppraiserVariant: z.string().optional(),
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
  createdAt: z.coerce.date(),
}).extend(PromptBundleFieldShape);
export type PromptBundleVersion = z.infer<typeof PromptBundleVersionSchema>;

export function buildPromptBundleVersion(input: {
  id: string;
  characterId: string;
  versionNumber: number;
  createdAt: Date | string;
  prompts: Partial<PromptBundleContent>;
}): PromptBundleVersion {
  return PromptBundleVersionSchema.parse({
    id: input.id,
    characterId: input.characterId,
    versionNumber: input.versionNumber,
    createdAt: input.createdAt,
    ...buildPromptBundleContent(input.prompts),
  });
}
