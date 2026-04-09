import { z } from 'zod';

export const EmotionNarrativeSchema = z.object({
  characterNarrative: z.string().min(1),
  relationshipNarrative: z.string().min(1),
  drivers: z.array(z.string().min(1)).min(1).max(3),
});

export type EmotionNarrative = z.infer<typeof EmotionNarrativeSchema>;
