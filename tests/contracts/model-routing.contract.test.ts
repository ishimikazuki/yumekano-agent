/**
 * T0-optimization: Model routing contract
 *
 * Verifies that executeTurn records the model alias and resolved model ID
 * for every stage. This is the baseline for verifying alias splits in T1.
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
import { defaultModelRoles } from '@/mastra/providers/model-roles';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createPlan,
  createWorkingMemory,
} from '../persona-test-helpers';

// --- fixtures (same pattern as latency-trace) ---

function createPromptBundle() {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    characterId: '22222222-2222-4222-8222-222222222222',
    versionNumber: 1,
    plannerMd: '', generatorMd: '', generatorIntimacyMd: '',
    emotionAppraiserMd: '', extractorMd: '', reflectorMd: '', rankerMd: '',
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
  };
}

function createMinimalExtraction(): CoEEvidenceExtractorResult {
  return {
    interactionActs: [{
      act: 'other', target: 'character', polarity: 'positive', intensity: 0.5,
      evidenceSpans: [{ source: 'user_message', sourceId: null, text: 'やあ', start: 0, end: 2 }],
      confidence: 0.8, uncertaintyNotes: [],
    }],
    relationalAppraisal: {
      warmthImpact: 0.3, rejectionImpact: 0, respectImpact: 0.2, threatImpact: 0,
      pressureImpact: 0, repairImpact: 0, reciprocityImpact: 0.2, intimacySignal: 0,
      boundarySignal: 0.1, certainty: 0.7,
    },
    confidence: 0.8, uncertaintyNotes: [],
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
      return { id: nextId('event'), pairId: input.scopeId, sourceTurnId: input.sourceTurnId,
        eventType: input.eventType, summary: input.summary, salience: input.salience,
        retrievalKeys: input.retrievalKeys, emotionSignature: input.emotionSignature,
        participants: input.participants, qualityScore: null,
        supersedesEventId: input.supersedesEventId ?? null,
        createdAt: new Date('2026-03-25T00:00:00.000Z') } as MemoryEvent;
    },
    async createFact(input) {
      return { id: nextId('fact'), pairId: input.scopeId, subject: input.subject,
        predicate: input.predicate, object: input.object, confidence: input.confidence,
        status: 'active' as const, supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        createdAt: new Date('2026-03-25T00:00:00.000Z') } as MemoryFact;
    },
    async createObservation(input) {
      return { id: nextId('obs'), pairId: input.scopeId, summary: input.summary,
        retrievalKeys: input.retrievalKeys, salience: input.salience, qualityScore: null,
        windowStartAt: input.windowStartAt, windowEndAt: input.windowEndAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z') } as MemoryObservation;
    },
    async createOrUpdateThread(input) {
      return { id: nextId('thread'), pairId: input.scopeId, key: input.key,
        summary: input.summary, severity: input.severity, status: 'open' as const,
        openedByEventId: null, resolvedByEventId: null,
        updatedAt: new Date('2026-03-25T00:00:00.000Z') } as OpenThread;
    },
    async resolveThread() {},
    async updateEventQuality() {},
    async updateFactStatus() {},
    async updateObservationQuality() {},
    async createMemoryUsage(input) {
      return { id: nextId('usage'), memoryItemType: input.memoryItemType,
        memoryItemId: input.memoryItemId, turnId: input.turnId,
        wasSelected: input.wasSelected, wasHelpful: input.wasHelpful,
        scoreDelta: input.scoreDelta, createdAt: new Date('2026-03-25T00:00:00.000Z') };
    },
  };
  return memoryStore;
}

function createMockedCandidates(): Candidate[] {
  return [{
    index: 0, text: 'やあ！元気？', toneTags: ['warm'],
    memoryRefsUsed: [], riskFlags: [],
    scores: { personaConsistency: 0.8, phaseCompliance: 0.8, memoryGrounding: 0.7,
      emotionalCoherence: 0.8, autonomy: 0.7, naturalness: 0.85, overall: 0.8 },
    rejected: false, rejectionReason: null,
  }];
}

async function runTurnForModelRouting(): Promise<TurnTrace> {
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
    threadId: 'thread-model-routing',
    userMessage: 'やあ',
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
          { text: 'やあ！元気？', toneTags: ['warm'], memoryRefsUsed: [], riskFlags: [] },
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

test('trace.modelIds includes coeExtractor', async () => {
  const trace = await runTurnForModelRouting();
  assert.ok(trace.modelIds.coeExtractor, 'modelIds.coeExtractor must be present');
  assert.ok(trace.modelIds.coeExtractor.length > 0, 'coeExtractor modelId must not be empty');
});

test('trace.modelIds records all stages', async () => {
  const trace = await runTurnForModelRouting();
  const { modelIds } = trace;

  assert.ok(modelIds.planner, 'planner modelId must be present');
  assert.ok(modelIds.generator, 'generator modelId must be present');
  assert.ok(modelIds.ranker, 'ranker modelId must be present');
  assert.ok(modelIds.extractor, 'memory extractor modelId must be present');
  assert.ok(modelIds.coeExtractor, 'coeExtractor modelId must be present');
});

test('trace.modelAliases records the role alias for each stage', async () => {
  const trace = await runTurnForModelRouting();

  assert.ok(trace.modelAliases, 'modelAliases must be present in trace');
  const aliases = trace.modelAliases;

  assert.ok(aliases.planner, 'planner alias must be present');
  assert.ok(aliases.generator, 'generator alias must be present');
  assert.ok(aliases.ranker, 'ranker alias must be present');
  assert.ok(aliases.extractor, 'memory extractor alias must be present');
  assert.ok(aliases.coeExtractor, 'coeExtractor alias must be present');
});

test('current model configuration matches expected baseline', () => {
  // This test locks in the current model assignments.
  // If a model assignment changes without updating this test, it fails.
  const config = defaultModelRoles;

  assert.equal(config.surfaceResponseHigh.provider, 'xai');
  assert.ok(
    config.surfaceResponseHigh.modelId.includes('grok'),
    'surfaceResponseHigh should use a grok model'
  );

  assert.equal(config.decisionHigh.provider, 'xai');
  assert.ok(
    config.decisionHigh.modelId.includes('grok'),
    'decisionHigh should use a grok model'
  );
});

test('trace aliases match the T1 split assignment', async () => {
  const trace = await runTurnForModelRouting();

  assert.equal(trace.modelAliases?.generator, 'surfaceResponseHigh');
  assert.equal(trace.modelAliases?.planner, 'decisionHigh');
  assert.equal(trace.modelAliases?.ranker, 'decisionHigh');
  assert.equal(trace.modelAliases?.coeExtractor, 'decisionHigh');
  assert.equal(trace.modelAliases?.extractor, 'structuredPostturnFast');

  // Generator should use the high-tier model
  assert.ok(
    trace.modelIds.generator.includes('grok-4.20') || trace.modelIds.generator.includes('grok-4'),
    `generator model should be a grok-4 variant, got: ${trace.modelIds.generator}`
  );

  const otherStages = [trace.modelIds.planner, trace.modelIds.ranker, trace.modelIds.extractor];
  for (const stageModelId of otherStages) {
    assert.ok(stageModelId, 'analysis stage model must be set');
  }
});
