import { z } from 'zod';

/**
 * Release channel
 */
export const ReleaseChannelSchema = z.enum(['prod']);
export type ReleaseChannel = z.infer<typeof ReleaseChannelSchema>;

/**
 * Release record - maps character to published version
 */
export const ReleaseSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  characterVersionId: z.string().uuid(),
  channel: ReleaseChannelSchema,
  publishedBy: z.string(),
  publishedAt: z.coerce.date(),
  rollbackOfReleaseId: z.string().uuid().nullable().describe('If this is a rollback, the release it rolls back'),
});
export type Release = z.infer<typeof ReleaseSchema>;
