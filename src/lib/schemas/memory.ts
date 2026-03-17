import { z } from 'zod';

/**
 * Memory event - episodic memory item
 */
export const MemoryEventSchema = z.object({
  id: z.string().uuid(),
  pairId: z.string().uuid(),
  sourceTurnId: z.string().uuid().nullable(),
  eventType: z.string().describe('Type of event (e.g., confession, argument, promise)'),
  summary: z.string().describe('Brief summary of the event'),
  salience: z.number().min(0).max(1).describe('Importance of the event'),
  retrievalKeys: z.array(z.string()).describe('Keywords for retrieval'),
  emotionSignature: z.object({
    pleasure: z.number().min(-1).max(1),
    arousal: z.number().min(-1).max(1),
    dominance: z.number().min(-1).max(1),
  }).nullable().describe('Emotional state during event'),
  participants: z.array(z.string()).describe('Who was involved'),
  qualityScore: z.number().min(0).max(1).nullable().describe('Quality label from evals'),
  supersedesEventId: z.string().uuid().nullable().describe('Event this supersedes'),
  createdAt: z.coerce.date(),
});
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

/**
 * Memory fact status
 */
export const MemoryFactStatusSchema = z.enum(['active', 'superseded', 'disputed']);
export type MemoryFactStatus = z.infer<typeof MemoryFactStatusSchema>;

/**
 * Memory fact - graph knowledge item
 */
export const MemoryFactSchema = z.object({
  id: z.string().uuid(),
  pairId: z.string().uuid(),
  subject: z.string().describe('Subject of the fact (e.g., user, character)'),
  predicate: z.string().describe('Relationship type (e.g., likes, promised)'),
  object: z.unknown().describe('Object of the fact'),
  confidence: z.number().min(0).max(1).describe('Confidence in this fact'),
  status: MemoryFactStatusSchema,
  supersedesFactId: z.string().uuid().nullable(),
  sourceEventId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
});
export type MemoryFact = z.infer<typeof MemoryFactSchema>;

/**
 * Memory observation - reflective summary block
 */
export const MemoryObservationSchema = z.object({
  id: z.string().uuid(),
  pairId: z.string().uuid(),
  summary: z.string().describe('Dense summary of patterns'),
  retrievalKeys: z.array(z.string()),
  salience: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1).nullable(),
  windowStartAt: z.coerce.date().describe('Start of observation window'),
  windowEndAt: z.coerce.date().describe('End of observation window'),
  createdAt: z.coerce.date(),
});
export type MemoryObservation = z.infer<typeof MemoryObservationSchema>;

/**
 * Open thread status
 */
export const OpenThreadStatusSchema = z.enum(['open', 'resolved']);
export type OpenThreadStatus = z.infer<typeof OpenThreadStatusSchema>;

/**
 * Open thread - unresolved relational/emotional thread
 */
export const OpenThreadSchema = z.object({
  id: z.string().uuid(),
  pairId: z.string().uuid(),
  key: z.string().describe('Unique key for this thread type'),
  summary: z.string().describe('What the thread is about'),
  severity: z.number().min(0).max(1).describe('How serious this thread is'),
  status: OpenThreadStatusSchema,
  openedByEventId: z.string().uuid().nullable(),
  resolvedByEventId: z.string().uuid().nullable(),
  updatedAt: z.coerce.date(),
});
export type OpenThread = z.infer<typeof OpenThreadSchema>;

/**
 * Working memory - always-available structured JSON
 */
export const WorkingMemorySchema = z.object({
  preferredAddressForm: z.string().nullable().describe('How user prefers to be called'),
  knownLikes: z.array(z.string()).describe('Things user is known to like'),
  knownDislikes: z.array(z.string()).describe('Things user is known to dislike'),
  currentCooldowns: z.record(z.string(), z.coerce.date()).describe('Topic cooldowns'),
  activeTensionSummary: z.string().nullable().describe('Current unresolved tension'),
  relationshipStance: z.string().nullable().describe('Current relationship stance'),
  knownCorrections: z.array(z.string()).describe('Hard corrections from user'),
  intimacyContextHints: z.array(z.string()).describe('Hints for intimacy context'),
});
export type WorkingMemory = z.infer<typeof WorkingMemorySchema>;

/**
 * Memory usage analytics
 */
export const MemoryUsageSchema = z.object({
  id: z.string().uuid(),
  memoryItemType: z.enum(['event', 'fact', 'observation', 'thread']),
  memoryItemId: z.string().uuid(),
  turnId: z.string().uuid(),
  wasSelected: z.boolean(),
  wasHelpful: z.boolean().nullable(),
  scoreDelta: z.number().nullable(),
  createdAt: z.coerce.date(),
});
export type MemoryUsage = z.infer<typeof MemoryUsageSchema>;
