import { memoryRepo } from '@/lib/repositories';
import { runReflector } from '../agents/reflector';
import type { CharacterVersion, PairState } from '@/lib/schemas';
import { characterRepo, pairRepo } from '@/lib/repositories';

export type ConsolidateMemoryInput = {
  pairId: string;
  mode: 'light' | 'deep';
};

export type ConsolidateMemoryOutput = {
  observationsCreated: number;
  threadsUpdated: number;
  factsMerged: number;
  qualityLabelsApplied: number;
  summary: string;
};

/**
 * Memory consolidation workflow.
 *
 * Trigger conditions:
 * - threshold crossed (e.g., 50 new events)
 * - session end
 * - manual dashboard action
 * - scheduled maintenance run
 *
 * Steps:
 * 1. Load recent raw turns and new episodic events
 * 2. Merge duplicates
 * 3. Create/update observation blocks
 * 4. Resolve or refresh open threads
 * 5. Attach or update quality labels
 */
export async function runConsolidateMemory(
  input: ConsolidateMemoryInput
): Promise<ConsolidateMemoryOutput> {
  const { pairId, mode } = input;

  // Get pair state
  const pairState = await pairRepo.getState(pairId);
  if (!pairState) {
    throw new Error(`Pair state not found for ${pairId}`);
  }

  // Get character version
  const characterVersion = await characterRepo.getVersionById(pairState.activeCharacterVersionId);
  if (!characterVersion) {
    throw new Error(`Character version not found`);
  }

  // Load memory items
  const eventLimit = mode === 'deep' ? 100 : 30;
  const recentEvents = await memoryRepo.getEventsByPair(pairId, eventLimit);
  const existingObservations = await memoryRepo.getObservationsByPair(pairId, 20);
  const existingOpenThreads = await memoryRepo.getOpenThreads(pairId);
  const existingGraphFacts = await memoryRepo.getFactsByPair(pairId, { status: 'active' });

  // Run reflector
  const reflectorResult = await runReflector({
    characterVersion,
    pairState,
    recentEvents,
    existingObservations,
    existingOpenThreads,
    existingGraphFacts,
  });

  // Process results
  let observationsCreated = 0;
  let threadsUpdated = 0;
  let factsMerged = 0;
  let qualityLabelsApplied = 0;

  // Create new observations
  for (const obs of reflectorResult.newObservations) {
    await memoryRepo.createObservation({
      pairId,
      summary: obs.summary,
      retrievalKeys: obs.retrievalKeys,
      salience: obs.salience,
      windowStartAt: recentEvents.length > 0
        ? new Date(recentEvents[recentEvents.length - 1].createdAt)
        : new Date(),
      windowEndAt: new Date(),
    });
    observationsCreated++;
  }

  // Process thread updates
  for (const update of reflectorResult.threadUpdates) {
    if (update.action === 'resolve') {
      await memoryRepo.resolveThread(pairId, update.key);
      threadsUpdated++;
    } else if (update.action === 'update' || update.action === 'escalate') {
      await memoryRepo.createOrUpdateThread({
        pairId,
        key: update.key,
        summary: update.newSummary ?? '',
        severity: update.newSeverity ?? 0.5,
      });
      threadsUpdated++;
    }
  }

  // Process fact merges (simplified - just update quality, actual merge is complex)
  for (const merge of reflectorResult.factMerges) {
    // Mark old facts as superseded and create merged fact
    for (const factId of merge.factIds.slice(1)) {
      await memoryRepo.updateFactStatus(factId, 'superseded');
    }
    factsMerged++;
  }

  // Apply quality labels
  for (const label of reflectorResult.qualityLabels) {
    if (label.itemType === 'event') {
      await memoryRepo.updateEventQuality(label.itemId, label.newQualityScore);
    }
    qualityLabelsApplied++;
  }

  return {
    observationsCreated,
    threadsUpdated,
    factsMerged,
    qualityLabelsApplied,
    summary: reflectorResult.reflectionSummary,
  };
}

/**
 * Check if consolidation should be triggered.
 */
export async function shouldTriggerConsolidation(pairId: string): Promise<boolean> {
  const recentEvents = await memoryRepo.getEventsByPair(pairId, 100);

  // Trigger if more than 30 events since last consolidation
  // In production, this would check timestamps
  if (recentEvents.length >= 30) {
    return true;
  }

  return false;
}
