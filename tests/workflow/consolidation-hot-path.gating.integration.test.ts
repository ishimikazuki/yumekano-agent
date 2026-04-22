/**
 * T3: consolidation hot-path gating
 *
 * Verifies that:
 *
 *   1. `executeTurn` does NOT await consolidation — it returns a
 *      `consolidationTask` promise analogous to `narrativeTask`.
 *      The user-facing response is ready before consolidation completes.
 *
 *   2. When the gate says "skip", consolidation work is not invoked.
 *
 *   3. When the gate says "run", the task eventually resolves without
 *      blocking the caller.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeTurn } from '@/mastra/workflows/execute-turn';
import { defaultModelRoles } from '@/mastra/providers/model-roles';
import type { MemoryStore } from '@/mastra/memory/store';
import type {
  Candidate,
  CoEEvidenceExtractorResult,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
} from '@/lib/schemas';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createPlan,
  createWorkingMemory,
} from '../persona-test-helpers';

function createPromptBundle() {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    characterId: '22222222-2222-4222-8222-222222222222',
    versionNumber: 1,
    plannerMd: '', generatorMd: '', generatorIntimacyMd: '',
    emotionAppraiserMd: '', extractorMd: '', reflectorMd: '', rankerMd: '',
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
  };
}

function createMinimalExtraction(): CoEEvidenceExtractorResult {
  return {
    interactionActs: [{
      act: 'other', target: 'character', polarity: 'positive', intensity: 0.5,
      evidenceSpans: [{ source: 'user_message', sourceId: null, text: 'hi', start: 0, end: 2 }],
      confidence: 0.8, uncertaintyNotes: [],
    }],
    relationalAppraisal: {
      warmthImpact: 0.3, rejectionImpact: 0, respectImpact: 0.2, threatImpact: 0,
      pressureImpact: 0, repairImpact: 0, reciprocityImpact: 0.2, intimacySignal: 0,
      boundarySignal: 0.1, certainty: 0.7, vulnerabilitySignal: 0,
    },
    confidence: 0.8, uncertaintyNotes: [],
  };
}

function createMemoryStoreFixture(): MemoryStore {
  const wm = createWorkingMemory();
  let idCounter = 0;
  const nextId = (prefix: string) =>
    `${prefix}${String(++idCounter).padStart(11, '0')}`.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,
      '$1-$2-4$3-8$4-$5'
    );
  return {
    async getWorkingMemory() { return wm; },
    async setWorkingMemory() {},
    getDefaultWorkingMemory() { return createWorkingMemory(); },
    async getOpenThreads() { return []; },
    async getFacts() { return []; },
    async getFactsBySubject() { return []; },
    async getEvents() { return []; },
    async getObservations() { return []; },
    async createEvent(input) {
      return {
        id: nextId('event'), pairId: input.scopeId, sourceTurnId: input.sourceTurnId,
        eventType: input.eventType, summary: input.summary, salience: input.salience,
        retrievalKeys: input.retrievalKeys, emotionSignature: input.emotionSignature,
        participants: input.participants, qualityScore: null,
        supersedesEventId: input.supersedesEventId ?? null,
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
      } as MemoryEvent;
    },
    async createFact(input) {
      return {
        id: nextId('fact'), pairId: input.scopeId, subject: input.subject,
        predicate: input.predicate, object: input.object, confidence: input.confidence,
        status: 'active' as const, supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
      } as MemoryFact;
    },
    async createObservation(input) {
      return {
        id: nextId('obs'), pairId: input.scopeId, summary: input.summary,
        retrievalKeys: input.retrievalKeys, salience: input.salience, qualityScore: null,
        windowStartAt: input.windowStartAt, windowEndAt: input.windowEndAt,
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
      } as MemoryObservation;
    },
    async createOrUpdateThread(input) {
      return {
        id: nextId('thread'), pairId: input.scopeId, key: input.key,
        summary: input.summary, severity: input.severity, status: 'open' as const,
        openedByEventId: null, resolvedByEventId: null,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      } as OpenThread;
    },
    async resolveThread() {},
    async updateEventQuality() {},
    async updateFactStatus() {},
    async updateObservationQuality() {},
    async createMemoryUsage(input) {
      return {
        id: nextId('usage'), memoryItemType: input.memoryItemType,
        memoryItemId: input.memoryItemId, turnId: input.turnId,
        wasSelected: input.wasSelected, wasHelpful: input.wasHelpful,
        scoreDelta: input.scoreDelta, createdAt: new Date('2026-04-21T00:00:00.000Z'),
      };
    },
  };
}

function createMockedCandidates(): Candidate[] {
  return [{
    index: 0, text: 'hi back!', toneTags: ['warm'],
    memoryRefsUsed: [], riskFlags: [],
    scores: { personaConsistency: 0.8, phaseCompliance: 0.8, memoryGrounding: 0.7,
      emotionalCoherence: 0.8, autonomy: 0.7, naturalness: 0.85, overall: 0.8 },
    rejected: false, rejectionReason: null,
  }];
}

async function runTurn(consolidateFn?: () => Promise<void>) {
  const characterVersion = createCharacterVersion();
  const currentPhase = createPhaseNode();
  const pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: currentPhase.id,
  });
  const promptBundle = createPromptBundle();
  const memoryStore = createMemoryStoreFixture();

  return await executeTurn({
    scopeId: pairState.pairId,
    tracePairId: pairState.pairId,
    traceCharacterVersionId: characterVersion.id,
    tracePromptBundleVersionId: promptBundle.id,
    threadId: 'thread-t3',
    userMessage: 'hi',
    characterVersion,
    phaseGraph: { entryPhaseId: currentPhase.id, nodes: [currentPhase], edges: [] },
    promptBundle,
    pairState,
    currentPhase,
    workingMemory: createWorkingMemory(),
    recentDialogue: [],
    turnsSinceLastTransition: 1,
    daysSinceEntry: 1,
    turnsSinceLastEmotionUpdate: 1,
    memoryStore,
    persistence: {
      async createTurnRecord() {},
      async persistTrace() {},
      async updatePairState() {},
      maybeConsolidate: consolidateFn,
    },
    deps: {
      now: () => new Date('2026-04-21T00:00:00.000Z'),
      runCoEEvidenceExtractor: async () => ({
        extraction: createMinimalExtraction(),
        modelId: defaultModelRoles.decisionHigh.modelId,
        systemPromptHash: 'coe-hash',
        attempts: 1,
      }),
      runPlanner: async () => ({
        plan: createPlan(),
        modelId: defaultModelRoles.decisionHigh.modelId,
        systemPromptHash: 'planner-hash',
      }),
      runGenerator: async () => ({
        candidates: [{ text: 'hi back!', toneTags: ['warm'], memoryRefsUsed: [], riskFlags: [] }],
        modelId: defaultModelRoles.surfaceResponseHigh.modelId,
        systemPromptHash: 'gen-hash',
      }),
      runRanker: async () => ({
        winnerIndex: 0,
        candidates: createMockedCandidates(),
        globalNotes: 'ok',
        modelId: defaultModelRoles.decisionHigh.modelId,
        systemPromptHash: 'ranker-hash',
      }),
      runMemoryExtractor: async () => ({
        extraction: {
          workingMemoryPatch: {}, episodicEvents: [], graphFacts: [],
          openThreadUpdates: [], extractionNotes: 'none',
        },
        modelId: defaultModelRoles.structuredPostturnFast.modelId,
        systemPromptHash: 'extractor-hash',
      }),
    },
  });
}

// --- tests ---

test('consolidation is NOT awaited before executeTurn resolves', async () => {
  let consolidationRunning = false;
  let consolidationReleased = false;
  const consolidateFn = async () => {
    consolidationRunning = true;
    // Simulate slow consolidation work — block until test releases it.
    while (!consolidationReleased) {
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  const result = await runTurn(consolidateFn);

  // If executeTurn awaited consolidation, it would never resolve
  // because we haven't released `consolidationReleased`. The fact that
  // we reached this line proves consolidation is deferred.
  assert.equal(typeof result.trace.id, 'string');
  assert.ok(consolidationRunning, 'consolidation must be started (fire-and-forget)');

  // Release the hold so the background task can finish.
  consolidationReleased = true;
  if (result.consolidationTask) {
    await result.consolidationTask;
  }
});

test('executeTurn returns a consolidationTask when maybeConsolidate is provided', async () => {
  let ran = false;
  const consolidateFn = async () => {
    ran = true;
  };
  const result = await runTurn(consolidateFn);

  assert.ok(
    result.consolidationTask instanceof Promise,
    'consolidationTask must be a Promise when maybeConsolidate is wired'
  );
  await result.consolidationTask;
  assert.equal(ran, true, 'maybeConsolidate must be invoked via the task');
});

test('executeTurn omits consolidationTask when maybeConsolidate is not provided', async () => {
  const result = await runTurn(undefined);
  assert.equal(
    result.consolidationTask,
    undefined,
    'consolidationTask must be undefined when gating says "skip"'
  );
});

test('consolidationTask surfaces internal errors as resolved (does not crash the request)', async () => {
  const consolidateFn = async () => {
    throw new Error('boom');
  };
  const result = await runTurn(consolidateFn);
  // Must not throw on the hot path even though consolidation errors internally.
  assert.ok(result.consolidationTask, 'consolidationTask must be returned');
  // And awaiting the task must not throw — errors are swallowed by the wrapper.
  await result.consolidationTask;
});
