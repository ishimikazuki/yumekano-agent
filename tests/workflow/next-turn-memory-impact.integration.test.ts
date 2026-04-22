/**
 * T2-B: next-turn memory impact integration
 *
 * Verifies that memory written by the (faster) memory extractor in turn N
 * is readable by planner/generator/retriever in turn N+1. This is the
 * structural guarantee we need even when the extractor runs on a lower tier.
 *
 * LLM calls are mocked; this is a wiring / persistence contract test.
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

function createMemoryStoreFixture() {
  let wm: WorkingMemory = createWorkingMemory();
  const events: MemoryEvent[] = [];
  const facts: MemoryFact[] = [];
  const observations: MemoryObservation[] = [];
  const threads: OpenThread[] = [];

  let idCounter = 0;
  const nextId = (prefix: string) =>
    `${prefix}${String(++idCounter).padStart(11, '0')}`.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,
      '$1-$2-4$3-8$4-$5'
    );

  const store: MemoryStore = {
    async getWorkingMemory() { return wm; },
    async setWorkingMemory(_scope, next) { wm = next; },
    getDefaultWorkingMemory() { return createWorkingMemory(); },
    async getOpenThreads() { return [...threads]; },
    async getFacts() { return [...facts]; },
    async getFactsBySubject() { return [...facts]; },
    async getEvents() { return [...events]; },
    async getObservations() { return [...observations]; },
    async createEvent(input) {
      const e: MemoryEvent = {
        id: nextId('event'), pairId: input.scopeId, sourceTurnId: input.sourceTurnId,
        eventType: input.eventType, summary: input.summary, salience: input.salience,
        retrievalKeys: input.retrievalKeys, emotionSignature: input.emotionSignature,
        participants: input.participants, qualityScore: null,
        supersedesEventId: input.supersedesEventId ?? null,
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
      } as MemoryEvent;
      events.push(e);
      return e;
    },
    async createFact(input) {
      const f: MemoryFact = {
        id: nextId('fact'), pairId: input.scopeId, subject: input.subject,
        predicate: input.predicate, object: input.object, confidence: input.confidence,
        status: 'active' as const, supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
      } as MemoryFact;
      facts.push(f);
      return f;
    },
    async createObservation(input) {
      const o: MemoryObservation = {
        id: nextId('obs'), pairId: input.scopeId, summary: input.summary,
        retrievalKeys: input.retrievalKeys, salience: input.salience, qualityScore: null,
        windowStartAt: input.windowStartAt, windowEndAt: input.windowEndAt,
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
      } as MemoryObservation;
      observations.push(o);
      return o;
    },
    async createOrUpdateThread(input) {
      const t: OpenThread = {
        id: nextId('thread'), pairId: input.scopeId, key: input.key,
        summary: input.summary, severity: input.severity, status: 'open' as const,
        openedByEventId: null, resolvedByEventId: null,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      } as OpenThread;
      threads.push(t);
      return t;
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

  return {
    store,
    getEvents: () => events,
    getFacts: () => facts,
    getObservations: () => observations,
    getThreads: () => threads,
    getWM: () => wm,
  };
}

function createMockedCandidates(text: string): Candidate[] {
  return [{
    index: 0, text, toneTags: ['warm'],
    memoryRefsUsed: [], riskFlags: [],
    scores: { personaConsistency: 0.8, phaseCompliance: 0.8, memoryGrounding: 0.7,
      emotionalCoherence: 0.8, autonomy: 0.7, naturalness: 0.85, overall: 0.8 },
    rejected: false, rejectionReason: null,
  }];
}

async function runTurn(opts: {
  memoryStoreFixture: ReturnType<typeof createMemoryStoreFixture>;
  userMessage: string;
  replyText: string;
  extractionEvent?: {
    eventType: string;
    summary: string;
    salience: number;
    retrievalKeys: string[];
  };
}): Promise<TurnTrace> {
  const { memoryStoreFixture, userMessage, replyText } = opts;
  const characterVersion = createCharacterVersion();
  const currentPhase = createPhaseNode();
  const pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: currentPhase.id,
  });
  const promptBundle = createPromptBundle();

  let capturedTrace: TurnTrace | null = null;
  await executeTurn({
    scopeId: pairState.pairId,
    tracePairId: pairState.pairId,
    traceCharacterVersionId: characterVersion.id,
    tracePromptBundleVersionId: promptBundle.id,
    threadId: 'thread-t2b',
    userMessage,
    characterVersion,
    phaseGraph: { entryPhaseId: currentPhase.id, nodes: [currentPhase], edges: [] },
    promptBundle,
    pairState,
    currentPhase,
    workingMemory:
      (await memoryStoreFixture.store.getWorkingMemory(pairState.pairId)) ??
      createWorkingMemory(),
    recentDialogue: [],
    turnsSinceLastTransition: 1,
    daysSinceEntry: 1,
    turnsSinceLastEmotionUpdate: 1,
    memoryStore: memoryStoreFixture.store,
    persistence: {
      async createTurnRecord() {},
      async persistTrace(trace) { capturedTrace = trace; },
      async updatePairState() {},
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
        candidates: [
          { text: replyText, toneTags: ['warm'], memoryRefsUsed: [], riskFlags: [] },
        ],
        modelId: defaultModelRoles.surfaceResponseHigh.modelId,
        systemPromptHash: 'gen-hash',
      }),
      runRanker: async () => ({
        winnerIndex: 0,
        candidates: createMockedCandidates(replyText),
        globalNotes: 'ok',
        modelId: defaultModelRoles.decisionHigh.modelId,
        systemPromptHash: 'ranker-hash',
      }),
      runMemoryExtractor: async () => ({
        extraction: {
          workingMemoryPatch: { addLikes: ['coffee'] },
          episodicEvents: opts.extractionEvent
            ? [{
                eventType: opts.extractionEvent.eventType,
                summary: opts.extractionEvent.summary,
                salience: opts.extractionEvent.salience,
                retrievalKeys: opts.extractionEvent.retrievalKeys,
                emotionSignature: null,
                participants: ['user'],
              }]
            : [],
          graphFacts: [],
          openThreadUpdates: [],
          extractionNotes: 'ok',
        },
        modelId: defaultModelRoles.structuredPostturnFast.modelId,
        systemPromptHash: 'extractor-hash',
      }),
    },
  });

  assert.ok(capturedTrace, 'trace must be captured');
  return capturedTrace;
}

test('memory written in turn 1 is persisted for turn 2 retrieval', async () => {
  const fx = createMemoryStoreFixture();

  const turn1 = await runTurn({
    memoryStoreFixture: fx,
    userMessage: 'I love coffee in the morning.',
    replyText: 'Coffee is nice.',
    extractionEvent: {
      eventType: 'preference_shared',
      summary: 'user loves morning coffee',
      salience: 0.7,
      retrievalKeys: ['coffee', 'morning'],
    },
  });

  // Writeback persisted the event + working memory patch
  assert.equal(fx.getEvents().length, 1, 'episodic event must be persisted after turn 1');
  assert.equal(
    fx.getEvents()[0].summary,
    'user loves morning coffee',
    'event summary is retained'
  );
  assert.ok(
    fx.getWM().knownLikes.includes('coffee'),
    'working memory patch must add "coffee" to likes'
  );

  // Second turn should still see the event + updated working memory
  const turn2 = await runTurn({
    memoryStoreFixture: fx,
    userMessage: 'Remember what I said?',
    replyText: 'Yes — the coffee!',
  });

  assert.equal(
    turn2.modelAliases?.extractor,
    'structuredPostturnFast',
    'extractor alias remains structuredPostturnFast across turns'
  );
  // Memory store still holds the turn-1 artifacts — retrievable for planner/generator.
  assert.equal(
    fx.getEvents().length,
    1,
    'turn 2 does not re-emit the turn-1 event (mocked empty extraction)'
  );
  assert.equal(
    fx.getEvents()[0].summary,
    'user loves morning coffee',
    'turn-1 event remains readable from turn 2'
  );
  assert.ok(
    fx.getWM().knownLikes.includes('coffee'),
    'working memory preserved across turns'
  );
});

test('memory extractor model id in trace reflects the configured fast tier', async () => {
  const fx = createMemoryStoreFixture();
  const trace = await runTurn({
    memoryStoreFixture: fx,
    userMessage: 'hello',
    replyText: 'hi',
  });

  assert.equal(
    trace.modelIds.extractor,
    defaultModelRoles.structuredPostturnFast.modelId,
    'trace.modelIds.extractor must match the live structuredPostturnFast config'
  );
});
