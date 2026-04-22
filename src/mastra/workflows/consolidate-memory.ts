import { characterRepo, pairRepo } from '@/lib/repositories';
import { createProductionMemoryStore, type MemoryStore } from '../memory/store';
import { runReflector } from '../agents/reflector';
import type { CharacterVersion, PairState } from '@/lib/schemas';

export type ConsolidateMemoryInput = {
  pairId?: string;
  scopeId?: string;
  mode: 'light' | 'deep';
  memoryStore?: MemoryStore;
  pairState?: PairState;
  characterVersion?: CharacterVersion;
};

export type ConsolidateMemoryOutput = {
  observationsCreated: number;
  threadsUpdated: number;
  factsMerged: number;
  qualityLabelsApplied: number;
  summary: string;
};

export async function runConsolidateMemory(
  input: ConsolidateMemoryInput
): Promise<ConsolidateMemoryOutput> {
  const scopeId = input.scopeId ?? input.pairId;
  if (!scopeId) {
    throw new Error('scopeId or pairId is required');
  }

  const memoryStore = input.memoryStore ?? createProductionMemoryStore();
  const pairState =
    input.pairState ??
    (await (async () => {
      const state = await pairRepo.getState(scopeId);
      if (!state) {
        throw new Error(`Pair state not found for ${scopeId}`);
      }
      return state;
    })());
  const characterVersion =
    input.characterVersion ??
    (await (async () => {
      const version = await characterRepo.getVersionById(pairState.activeCharacterVersionId);
      if (!version) {
        throw new Error(`Character version not found`);
      }
      return version;
    })());

  const eventLimit = input.mode === 'deep' ? 100 : 30;
  const recentEvents = await memoryStore.getEvents(scopeId, eventLimit);
  const existingObservations = await memoryStore.getObservations(scopeId, 20);
  const existingOpenThreads = await memoryStore.getOpenThreads(scopeId);
  const existingGraphFacts = await memoryStore.getFacts(scopeId, { status: 'active' });

  const reflectorResult = await runReflector({
    characterVersion,
    pairState,
    recentEvents,
    existingObservations,
    existingOpenThreads,
    existingGraphFacts,
  });

  let observationsCreated = 0;
  let threadsUpdated = 0;
  let factsMerged = 0;
  let qualityLabelsApplied = 0;

  const windowStartAt =
    recentEvents.length > 0 ? new Date(recentEvents[recentEvents.length - 1].createdAt) : new Date();

  for (const observation of reflectorResult.newObservations) {
    await memoryStore.createObservation({
      scopeId,
      summary: observation.summary,
      retrievalKeys: observation.retrievalKeys,
      salience: observation.salience,
      windowStartAt,
      windowEndAt: new Date(),
    });
    observationsCreated++;
  }

  for (const update of reflectorResult.threadUpdates) {
    if (update.action === 'resolve') {
      await memoryStore.resolveThread(scopeId, update.key);
      threadsUpdated++;
      continue;
    }

    await memoryStore.createOrUpdateThread({
      scopeId,
      key: update.key,
      summary: update.newSummary ?? update.key,
      severity: update.newSeverity ?? 0.5,
    });
    threadsUpdated++;
  }

  for (const merge of reflectorResult.factMerges) {
    const [primaryFactId, ...supersededFactIds] = merge.factIds;
    for (const factId of supersededFactIds) {
      await memoryStore.updateFactStatus(factId, 'superseded');
    }
    await memoryStore.createFact({
      scopeId,
      subject: merge.mergedFact.subject,
      predicate: merge.mergedFact.predicate,
      object: merge.mergedFact.object,
      confidence: merge.mergedFact.confidence,
      supersedesFactId: primaryFactId ?? null,
    });
    factsMerged++;
  }

  for (const label of reflectorResult.qualityLabels) {
    if (label.itemType === 'event') {
      await memoryStore.updateEventQuality(label.itemId, label.newQualityScore);
      qualityLabelsApplied++;
      continue;
    }
    if (label.itemType === 'fact') {
      continue;
    }
    await memoryStore.updateObservationQuality(label.itemId, label.newQualityScore);
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

export async function shouldTriggerConsolidation(input: {
  pairId?: string;
  scopeId?: string;
  memoryStore?: MemoryStore;
  threshold?: number;
  /**
   * Minimum average salience of recent events to trigger at the base threshold.
   * If average salience is below this floor, the effective threshold is
   * doubled — low-salience activity pays consolidation less often.
   * Defaults to 0.3.
   */
  salienceFloor?: number;
}): Promise<boolean> {
  const scopeId = input.scopeId ?? input.pairId;
  if (!scopeId) {
    throw new Error('scopeId or pairId is required');
  }

  const memoryStore = input.memoryStore ?? createProductionMemoryStore();
  const baseThreshold = input.threshold ?? 30;
  const salienceFloor = input.salienceFloor ?? 0.3;

  // Fetch up to 2× the threshold so we can detect the low-salience case.
  const recentEvents = await memoryStore.getEvents(scopeId, baseThreshold * 2);

  // Nothing meaningful to consolidate yet.
  if (recentEvents.length < baseThreshold) {
    return false;
  }

  const avgSalience =
    recentEvents.reduce((sum, e) => sum + (e.salience ?? 0.5), 0) /
    recentEvents.length;

  const effectiveThreshold =
    avgSalience < salienceFloor ? baseThreshold * 2 : baseThreshold;

  return recentEvents.length >= effectiveThreshold;
}
