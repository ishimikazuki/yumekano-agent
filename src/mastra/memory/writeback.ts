import type {
  Candidate,
  MemoryPolicySpec,
  MemoryThresholdDecision,
  MemoryWrite,
  WorkingMemory,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
} from '@/lib/schemas';
import type { MemoryExtractionResult } from '../agents/memory-extractor';
import type { MemoryStore } from './store';

export async function processMemoryWrites(input: {
  memoryStore: MemoryStore;
  scopeId: string;
  sourceTurnId: string | null;
  extraction: MemoryExtractionResult;
  currentWorkingMemory: WorkingMemory;
  memoryPolicy: MemoryPolicySpec;
}): Promise<{ writes: MemoryWrite[]; thresholdDecisions: MemoryThresholdDecision[]; workingMemory: WorkingMemory }> {
  const { memoryStore, scopeId, sourceTurnId, extraction, currentWorkingMemory, memoryPolicy } = input;
  const writes: MemoryWrite[] = [];
  const thresholdDecisions: MemoryThresholdDecision[] = [];

  for (const event of extraction.episodicEvents) {
    const passed = event.salience >= memoryPolicy.eventSalienceThreshold;
    thresholdDecisions.push({
      kind: 'event',
      summary: event.summary,
      passed,
      reason: passed
        ? `salience ${event.salience.toFixed(2)} >= ${memoryPolicy.eventSalienceThreshold.toFixed(2)}`
        : `salience ${event.salience.toFixed(2)} < ${memoryPolicy.eventSalienceThreshold.toFixed(2)}`,
    });
    if (!passed) continue;

    const created = await memoryStore.createEvent({
      scopeId,
      sourceTurnId,
      eventType: event.eventType,
      summary: event.summary,
      salience: event.salience,
      retrievalKeys: event.retrievalKeys,
      emotionSignature: event.emotionSignature,
      participants: event.participants,
    });
    writes.push({
      type: 'event',
      itemId: created.id,
      sourceTurnId,
      summary: event.summary,
    });
  }

  for (const fact of extraction.graphFacts) {
    const passed = fact.confidence >= memoryPolicy.factConfidenceThreshold;
    thresholdDecisions.push({
      kind: 'fact',
      summary: `${fact.subject} ${fact.predicate}`,
      passed,
      reason: passed
        ? `confidence ${fact.confidence.toFixed(2)} >= ${memoryPolicy.factConfidenceThreshold.toFixed(2)}`
        : `confidence ${fact.confidence.toFixed(2)} < ${memoryPolicy.factConfidenceThreshold.toFixed(2)}`,
    });
    if (!passed) continue;

    const supersedesFactId = fact.supersedesExisting
      ? (await memoryStore.getFactsBySubject(scopeId, fact.subject)).find(
          (existing) => existing.predicate === fact.predicate && existing.status === 'active'
        )?.id ?? null
      : null;

    const created = await memoryStore.createFact({
      scopeId,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      confidence: fact.confidence,
      supersedesFactId,
    });
    writes.push({
      type: 'fact',
      itemId: created.id,
      sourceTurnId,
      summary: `${fact.subject} ${fact.predicate} ${JSON.stringify(fact.object)}`,
    });
  }

  for (const threadUpdate of extraction.openThreadUpdates) {
    if (threadUpdate.action === 'resolve') {
      await memoryStore.resolveThread(scopeId, threadUpdate.key);
      writes.push({
        type: 'thread_resolve',
        itemId: null,
        sourceTurnId,
        summary: `Resolved: ${threadUpdate.key}`,
      });
      continue;
    }

    const thread = await memoryStore.createOrUpdateThread({
      scopeId,
      key: threadUpdate.key,
      summary: threadUpdate.summary ?? '',
      severity: threadUpdate.severity ?? 0.5,
    });
    writes.push({
      type: 'thread_open',
      itemId: thread.id,
      sourceTurnId,
      summary: threadUpdate.summary ?? threadUpdate.key,
    });
  }

  const updatedWorkingMemory = applyWorkingMemoryPatch(currentWorkingMemory, extraction.workingMemoryPatch);
  await memoryStore.setWorkingMemory(scopeId, updatedWorkingMemory);
  writes.push({
    type: 'working_memory',
    itemId: null,
    sourceTurnId,
    summary: 'Working memory updated',
  });

  return { writes, thresholdDecisions, workingMemory: updatedWorkingMemory };
}

export function applyWorkingMemoryPatch(
  currentWorkingMemory: WorkingMemory,
  patch: MemoryExtractionResult['workingMemoryPatch']
): WorkingMemory {
  const updatedWorkingMemory = { ...currentWorkingMemory };

  if (patch.preferredAddressForm !== undefined) {
    updatedWorkingMemory.preferredAddressForm = patch.preferredAddressForm;
  }
  if (patch.addLikes) {
    updatedWorkingMemory.knownLikes = [
      ...new Set([...updatedWorkingMemory.knownLikes, ...patch.addLikes]),
    ];
  }
  if (patch.addDislikes) {
    updatedWorkingMemory.knownDislikes = [
      ...new Set([...updatedWorkingMemory.knownDislikes, ...patch.addDislikes]),
    ];
  }
  if (patch.addCorrections) {
    updatedWorkingMemory.knownCorrections = [
      ...new Set([...updatedWorkingMemory.knownCorrections, ...patch.addCorrections]),
    ];
  }
  if (patch.activeTensionSummary !== undefined) {
    updatedWorkingMemory.activeTensionSummary = patch.activeTensionSummary;
  }
  if (patch.relationshipStance !== undefined) {
    updatedWorkingMemory.relationshipStance = patch.relationshipStance;
  }
  if (patch.addIntimacyHints) {
    updatedWorkingMemory.intimacyContextHints = [
      ...new Set([...updatedWorkingMemory.intimacyContextHints, ...patch.addIntimacyHints]),
    ];
  }

  return updatedWorkingMemory;
}

export async function recordMemoryUsage(input: {
  memoryStore: MemoryStore;
  scopeId: string;
  turnId: string;
  retrievedMemory: {
    events: MemoryEvent[];
    facts: MemoryFact[];
    observations: MemoryObservation[];
    threads: OpenThread[];
  };
  candidates: Candidate[];
  winnerIndex: number;
}): Promise<void> {
  const { memoryStore, scopeId, turnId, retrievedMemory, candidates, winnerIndex } = input;
  const winner = candidates.find((candidate) => candidate.index === winnerIndex) ?? candidates[0];
  if (!winner) return;

  const memoryItems = [
    ...retrievedMemory.events.map((item) => ({ type: 'event' as const, item })),
    ...retrievedMemory.facts.map((item) => ({ type: 'fact' as const, item })),
    ...retrievedMemory.observations.map((item) => ({ type: 'observation' as const, item })),
    ...retrievedMemory.threads.map((item) => ({ type: 'thread' as const, item })),
  ];

  for (const { type, item } of memoryItems) {
    const candidatesUsingItem = candidates.filter((candidate) =>
      candidate.memoryRefsUsed.includes(item.id)
    );
    const bestUsing = candidatesUsingItem.reduce((best, candidate) => {
      return Math.max(best, candidate.scores.overall);
    }, 0);
    const bestWithout = candidates
      .filter((candidate) => !candidate.memoryRefsUsed.includes(item.id))
      .reduce((best, candidate) => Math.max(best, candidate.scores.overall), 0);

    await memoryStore.createMemoryUsage({
      scopeId,
      memoryItemType: type,
      memoryItemId: item.id,
      turnId,
      wasSelected: winner.memoryRefsUsed.includes(item.id),
      wasHelpful: candidatesUsingItem.length > 0 ? bestUsing >= bestWithout : null,
      scoreDelta: candidatesUsingItem.length > 0 ? Number((bestUsing - bestWithout).toFixed(4)) : null,
    });
  }
}
