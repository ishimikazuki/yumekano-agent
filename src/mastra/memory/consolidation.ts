import { memoryRepo } from '@/lib/repositories';
import type {
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
} from '@/lib/schemas';

/**
 * Memory consolidation utilities.
 * Handles merging, compacting, and quality management of long-term memory.
 */

export type ConsolidationConfig = {
  eventSalienceThreshold: number;
  factConfidenceThreshold: number;
  observationCompressionTarget: number;
  maxEventsToProcess: number;
  maxFactsToKeep: number;
};

const DEFAULT_CONFIG: ConsolidationConfig = {
  eventSalienceThreshold: 0.3,
  factConfidenceThreshold: 0.5,
  observationCompressionTarget: 500,
  maxEventsToProcess: 100,
  maxFactsToKeep: 200,
};

/**
 * Merge duplicate facts with the same subject-predicate pair.
 */
export async function mergeDuplicateFacts(
  pairId: string,
  factIds: string[],
  mergedData: {
    subject: string;
    predicate: string;
    object: unknown;
    confidence: number;
  }
): Promise<MemoryFact> {
  // Mark all old facts as superseded and create the merged one
  const newFact = await memoryRepo.createFact({
    pairId,
    ...mergedData,
    supersedesFactId: factIds[0], // Link to first fact for audit trail
  });

  // Mark remaining facts as superseded
  for (let i = 1; i < factIds.length; i++) {
    await memoryRepo.updateFactStatus(factIds[i], 'superseded');
  }

  return newFact;
}

/**
 * Prune low-quality events below the salience threshold.
 */
export async function pruneLowSalienceEvents(
  pairId: string,
  config: Partial<ConsolidationConfig> = {}
): Promise<number> {
  const { eventSalienceThreshold } = { ...DEFAULT_CONFIG, ...config };
  const events = await memoryRepo.getEventsByPair(pairId, 500);

  let prunedCount = 0;
  for (const event of events) {
    if (event.salience < eventSalienceThreshold && event.qualityScore !== null && event.qualityScore < 0.3) {
      // Instead of deleting, we mark quality as very low for future filtering
      await memoryRepo.updateEventQuality(event.id, 0);
      prunedCount++;
    }
  }

  return prunedCount;
}

/**
 * Resolve open threads that have been stale for too long.
 */
export async function resolveStaleThreads(
  pairId: string,
  staleDays: number = 30
): Promise<string[]> {
  const threads = await memoryRepo.getOpenThreads(pairId);
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);
  const resolved: string[] = [];

  for (const thread of threads) {
    const updatedAt = new Date(thread.updatedAt);
    if (updatedAt < staleThreshold && thread.severity < 0.5) {
      await memoryRepo.resolveThread(pairId, thread.key);
      resolved.push(thread.key);
    }
  }

  return resolved;
}

/**
 * Get memory statistics for a pair.
 */
export async function getMemoryStats(pairId: string): Promise<{
  eventCount: number;
  factCount: number;
  observationCount: number;
  openThreadCount: number;
  avgEventSalience: number;
  avgFactConfidence: number;
}> {
  const [events, facts, observations, threads] = await Promise.all([
    memoryRepo.getEventsByPair(pairId, 1000),
    memoryRepo.getFactsByPair(pairId, { status: 'active' }),
    memoryRepo.getObservationsByPair(pairId, 100),
    memoryRepo.getOpenThreads(pairId),
  ]);

  const avgEventSalience = events.length > 0
    ? events.reduce((sum, e) => sum + e.salience, 0) / events.length
    : 0;

  const avgFactConfidence = facts.length > 0
    ? facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length
    : 0;

  return {
    eventCount: events.length,
    factCount: facts.length,
    observationCount: observations.length,
    openThreadCount: threads.length,
    avgEventSalience,
    avgFactConfidence,
  };
}

/**
 * Check if consolidation should be triggered.
 */
export function shouldTriggerConsolidationFromStats(
  stats: {
    eventCount: number;
    factCount: number;
    observationCount: number;
    openThreadCount: number;
  },
  thresholds: {
    maxEvents?: number;
    maxFacts?: number;
    maxObservations?: number;
  } = {}
): boolean {
  const {
    maxEvents = 100,
    maxFacts = 200,
    maxObservations = 50,
  } = thresholds;

  return (
    stats.eventCount > maxEvents ||
    stats.factCount > maxFacts ||
    stats.observationCount > maxObservations
  );
}

/**
 * Get events that should be included in a new observation.
 */
export async function getEventsForObservation(
  pairId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<MemoryEvent[]> {
  const allEvents = await memoryRepo.getEventsByPair(pairId, 200);

  return allEvents.filter(event => {
    const eventTime = new Date(event.createdAt);
    return eventTime >= windowStart && eventTime <= windowEnd;
  });
}

/**
 * Create a new observation from events.
 */
export async function createObservationFromEvents(
  pairId: string,
  summary: string,
  retrievalKeys: string[],
  salience: number,
  windowStart: Date,
  windowEnd: Date
): Promise<MemoryObservation> {
  return memoryRepo.createObservation({
    pairId,
    summary,
    retrievalKeys,
    salience,
    windowStartAt: windowStart,
    windowEndAt: windowEnd,
  });
}
