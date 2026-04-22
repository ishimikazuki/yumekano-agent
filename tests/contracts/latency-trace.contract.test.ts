/**
 * T0-optimization: Latency trace contract
 *
 * Verifies that executeTurn records per-stage latency in the trace.
 * This is the baseline for measuring optimization impact in T2+.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeTurn } from '@/mastra/workflows/execute-turn';
import type { MemoryStore } from '@/mastra/memory/store';
import type {
  Candidate,
  CoEEvidenceExtractorResult,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  TurnTrace,
  WorkingMemory,
} from '@/lib/schemas';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createPlan,
  createWorkingMemory,
} from '../persona-test-helpers';

// --- fixtures ---

function createPromptBundle() {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    characterId: '22222222-2222-4222-8222-222222222222',
    versionNumber: 1,
    plannerMd: '',
    generatorMd: '',
    generatorIntimacyMd: '',
    emotionAppraiserMd: '',
    extractorMd: '',
    reflectorMd: '',
    rankerMd: '',
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
  };
}

function createMinimalExtraction(): CoEEvidenceExtractorResult {
  return {
    interactionActs: [
      {
        act: 'other',
        target: 'character',
        polarity: 'positive',
        intensity: 0.5,
        evidenceSpans: [{ source: 'user_message', sourceId: null, text: 'おはよう', start: 0, end: 4 }],
        confidence: 0.8,
        uncertaintyNotes: [],
      },
    ],
    relationalAppraisal: {
      warmthImpact: 0.3,
      rejectionImpact: 0,
      respectImpact: 0.2,
      threatImpact: 0,
      pressureImpact: 0,
      repairImpact: 0,
      reciprocityImpact: 0.2,
      intimacySignal: 0,
      boundarySignal: 0.1,
      certainty: 0.7,
    },
    confidence: 0.8,
    uncertaintyNotes: [],
  };
}

function createMemoryStoreFixture() {
  const wm = createWorkingMemory();
  let idCounter = 0;
  const nextId = (prefix: string) =>
    `${prefix}${String(++idCounter).padStart(11, '0')}`.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,
      '$1-$2-4$3-8$4-$5'
    );

  const memoryStore: MemoryStore = {
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
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      } as MemoryEvent;
    },
    async createFact(input) {
      return {
        id: nextId('fact'), pairId: input.scopeId, subject: input.subject,
        predicate: input.predicate, object: input.object, confidence: input.confidence,
        status: 'active' as const, supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      } as MemoryFact;
    },
    async createObservation(input) {
      return {
        id: nextId('obs'), pairId: input.scopeId, summary: input.summary,
        retrievalKeys: input.retrievalKeys, salience: input.salience, qualityScore: null,
        windowStartAt: input.windowStartAt, windowEndAt: input.windowEndAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      } as MemoryObservation;
    },
    async createOrUpdateThread(input) {
      return {
        id: nextId('thread'), pairId: input.scopeId, key: input.key,
        summary: input.summary, severity: input.severity, status: 'open' as const,
        openedByEventId: null, resolvedByEventId: null,
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
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
        scoreDelta: input.scoreDelta, createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
    },
  };
  return memoryStore;
}

function createMockedCandidates(): Candidate[] {
  return [
    {
      index: 0, text: 'おはよう！今日もいい天気だね。', toneTags: ['warm'],
      memoryRefsUsed: [], riskFlags: [],
      scores: { personaConsistency: 0.8, phaseCompliance: 0.8, memoryGrounding: 0.7,
        emotionalCoherence: 0.8, autonomy: 0.7, naturalness: 0.85, overall: 0.8 },
      rejected: false, rejectionReason: null,
    },
  ];
}

async function runTurnWithLatencyTrace(): Promise<TurnTrace> {
  const characterVersion = createCharacterVersion();
  const currentPhase = createPhaseNode();
  const pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: currentPhase.id,
  });
  const promptBundle = createPromptBundle();
  const memoryStore = createMemoryStoreFixture();

  let capturedTrace: TurnTrace | null = null;

  await executeTurn({
    scopeId: pairState.pairId,
    tracePairId: pairState.pairId,
    traceCharacterVersionId: characterVersion.id,
    tracePromptBundleVersionId: promptBundle.id,
    threadId: 'thread-latency',
    userMessage: 'おはよう',
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
      async persistTrace(trace) { capturedTrace = trace; },
      async updatePairState() {},
    },
    deps: {
      now: () => new Date('2026-03-25T00:00:00.000Z'),
      runCoEEvidenceExtractor: async () => ({
        extraction: createMinimalExtraction(),
        modelId: 'xai/grok-4-1-fast-reasoning',
        systemPromptHash: 'coe-hash',
        attempts: 1,
      }),
      runPlanner: async () => ({
        plan: createPlan(),
        modelId: 'xai/grok-4-1-fast-reasoning',
        systemPromptHash: 'planner-hash',
      }),
      runGenerator: async () => ({
        candidates: [
          { text: 'おはよう！今日もいい天気だね。', toneTags: ['warm'], memoryRefsUsed: [], riskFlags: [] },
        ],
        modelId: 'xai/grok-4.20-reasoning',
        systemPromptHash: 'gen-hash',
      }),
      runRanker: async () => ({
        winnerIndex: 0,
        candidates: createMockedCandidates(),
        globalNotes: 'ok',
        modelId: 'xai/grok-4-1-fast-reasoning',
        systemPromptHash: 'ranker-hash',
      }),
      runMemoryExtractor: async () => ({
        extraction: {
          workingMemoryPatch: {},
          episodicEvents: [],
          graphFacts: [],
          openThreadUpdates: [],
          extractionNotes: 'none',
        },
        modelId: 'xai/grok-4-1-fast-reasoning',
        systemPromptHash: 'extractor-hash',
      }),
    },
  });

  assert.ok(capturedTrace, 'trace must be captured');
  return capturedTrace;
}

// --- tests ---

test('trace contains stageLatencies with all required stage timings', async () => {
  const trace = await runTurnWithLatencyTrace();

  assert.ok(trace.stageLatencies, 'stageLatencies must be present in trace');
  const latencies = trace.stageLatencies;

  // All required stages must be present
  assert.ok(typeof latencies.coeExtractorMs === 'number', 'coeExtractorMs must be a number');
  assert.ok(typeof latencies.plannerMs === 'number', 'plannerMs must be a number');
  assert.ok(typeof latencies.generatorMs === 'number', 'generatorMs must be a number');
  assert.ok(typeof latencies.rankerMs === 'number', 'rankerMs must be a number');
  assert.ok(typeof latencies.memoryExtractorMs === 'number', 'memoryExtractorMs must be a number');
  assert.ok(typeof latencies.totalMs === 'number', 'totalMs must be a number');
});

test('stage latencies are non-negative', async () => {
  const trace = await runTurnWithLatencyTrace();
  const latencies = trace.stageLatencies!;

  assert.ok(latencies.coeExtractorMs >= 0, 'coeExtractorMs must be >= 0');
  assert.ok(latencies.plannerMs >= 0, 'plannerMs must be >= 0');
  assert.ok(latencies.generatorMs >= 0, 'generatorMs must be >= 0');
  assert.ok(latencies.rankerMs >= 0, 'rankerMs must be >= 0');
  assert.ok(latencies.memoryExtractorMs >= 0, 'memoryExtractorMs must be >= 0');
  assert.ok(latencies.totalMs >= 0, 'totalMs must be >= 0');
});

test('totalMs is >= sum of individual stage latencies', async () => {
  const trace = await runTurnWithLatencyTrace();
  const l = trace.stageLatencies!;
  const stageSum = l.coeExtractorMs + l.plannerMs + l.generatorMs + l.rankerMs + l.memoryExtractorMs;
  assert.ok(l.totalMs >= stageSum, `totalMs (${l.totalMs}) must be >= stage sum (${stageSum})`);
});
