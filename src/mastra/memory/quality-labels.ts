import { memoryRepo } from '@/lib/repositories';

/**
 * Memory quality label management.
 * Each durable memory item may carry quality scores that affect retrieval ranking.
 */

export type QualityLabel = {
  itemId: string;
  itemType: 'event' | 'fact' | 'observation';
  qualityScore: number;
  wasHelpful: boolean;
  linkedEvalFailures: string[];
  lastUsedAt: string | null;
};

/**
 * Update quality score for a memory item.
 */
export async function updateQualityScore(
  itemId: string,
  itemType: 'event' | 'fact' | 'observation',
  score: number
): Promise<void> {
  const clampedScore = Math.max(0, Math.min(1, score));

  switch (itemType) {
    case 'event':
      await memoryRepo.updateEventQuality(itemId, clampedScore);
      break;
    case 'fact':
      // Facts use status for quality management
      if (clampedScore < 0.3) {
        await memoryRepo.updateFactStatus(itemId, 'disputed');
      }
      break;
    case 'observation':
      await memoryRepo.updateObservationQuality(itemId, clampedScore);
      break;
  }
}

/**
 * Mark a memory item as helpful (positive feedback).
 */
export async function markAsHelpful(
  itemId: string,
  itemType: 'event' | 'fact' | 'observation'
): Promise<void> {
  // Boost quality score when marked helpful
  await updateQualityScore(itemId, itemType, 0.9);
}

/**
 * Mark a memory item as unhelpful (negative feedback).
 */
export async function markAsUnhelpful(
  itemId: string,
  itemType: 'event' | 'fact' | 'observation'
): Promise<void> {
  // Reduce quality score when marked unhelpful
  await updateQualityScore(itemId, itemType, 0.3);
}

/**
 * Link an eval failure to a memory item.
 * This helps identify memories that correlate with bad outputs.
 */
export async function linkEvalFailure(
  itemId: string,
  itemType: 'event' | 'fact' | 'observation',
  evalCaseId: string
): Promise<void> {
  // For now, we just reduce the quality score
  // In future, we could store linked failures separately
  await updateQualityScore(itemId, itemType, 0.5);
}

/**
 * Decay quality scores over time for items not recently used.
 */
export async function decayUnusedQuality(
  pairId: string,
  decayFactor: number = 0.95,
  unusedDays: number = 30
): Promise<number> {
  const events = await memoryRepo.getEventsByPair(pairId, 500);
  const cutoff = new Date(Date.now() - unusedDays * 24 * 60 * 60 * 1000);
  let decayedCount = 0;

  for (const event of events) {
    const createdAt = new Date(event.createdAt);
    if (createdAt < cutoff && event.qualityScore !== null && event.qualityScore > 0.5) {
      const newScore = event.qualityScore * decayFactor;
      await memoryRepo.updateEventQuality(event.id, newScore);
      decayedCount++;
    }
  }

  return decayedCount;
}

/**
 * Get quality distribution for memory analytics.
 */
export async function getQualityDistribution(pairId: string): Promise<{
  highQuality: number;
  mediumQuality: number;
  lowQuality: number;
  unscored: number;
}> {
  const events = await memoryRepo.getEventsByPair(pairId, 1000);

  let highQuality = 0;
  let mediumQuality = 0;
  let lowQuality = 0;
  let unscored = 0;

  for (const event of events) {
    if (event.qualityScore === null) {
      unscored++;
    } else if (event.qualityScore >= 0.7) {
      highQuality++;
    } else if (event.qualityScore >= 0.4) {
      mediumQuality++;
    } else {
      lowQuality++;
    }
  }

  return { highQuality, mediumQuality, lowQuality, unscored };
}

/**
 * Apply quality boost based on retrieval success.
 */
export async function boostRetrievedMemoryQuality(
  retrievedItemIds: string[],
  itemType: 'event' | 'fact' | 'observation',
  boostFactor: number = 0.05
): Promise<void> {
  for (const itemId of retrievedItemIds) {
    // Slightly increase quality for successfully retrieved items
    // This creates a positive feedback loop for useful memories
    await updateQualityScore(itemId, itemType, 0.7 + boostFactor);
  }
}
