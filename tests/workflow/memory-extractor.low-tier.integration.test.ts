/**
 * T2 (A + B): memory-extractor low-tier integration
 *
 * Verifies that the memory extractor stage actually resolves to the
 * `structuredPostturnFast` alias end-to-end:
 *
 *   T2-A (alias only) — trace.modelAliases.extractor === 'structuredPostturnFast',
 *                        model id still matches decisionHigh (same tier as before).
 *
 *   T2-B (low tier)   — trace.modelIds.extractor reflects the dedicated
 *                        structuredPostturnFast model id (distinct from
 *                        decisionHigh when STRUCTURED_POSTTURN_MODEL or
 *                        the default differs).
 *
 * The test runs the full executeTurn pipeline with mocked LLM calls, so we
 * are verifying routing + trace shape only — not model quality.
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
      boundarySignal: 0.1, certainty: 0.7,
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

async function runTurnWithMemoryExtractorRouting(): Promise<TurnTrace> {
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
    threadId: 'thread-t2',
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
          { text: 'hi back!', toneTags: ['warm'], memoryRefsUsed: [], riskFlags: [] },
        ],
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
          workingMemoryPatch: {},
          episodicEvents: [],
          graphFacts: [],
          openThreadUpdates: [],
          extractionNotes: 'none',
        },
        // The dep reports back whichever model id the registry resolved for
        // the structuredPostturnFast alias. This is what we want to assert on.
        modelId: defaultModelRoles.structuredPostturnFast.modelId,
        systemPromptHash: 'extractor-hash',
      }),
    },
  });

  assert.ok(capturedTrace, 'trace must be captured');
  return capturedTrace;
}

// --- T2-A: alias routing ---

test('memory extractor stage reports structuredPostturnFast alias in trace', async () => {
  const trace = await runTurnWithMemoryExtractorRouting();
  assert.equal(
    trace.modelAliases?.extractor,
    'structuredPostturnFast',
    'memory extractor alias must be structuredPostturnFast after T2-A'
  );
});

test('memory extractor trace modelId matches the registry default for structuredPostturnFast', async () => {
  const trace = await runTurnWithMemoryExtractorRouting();
  assert.equal(
    trace.modelIds.extractor,
    defaultModelRoles.structuredPostturnFast.modelId,
    'trace.modelIds.extractor must reflect the structuredPostturnFast default model id'
  );
});

test('current-turn assistant reply is unaffected by memory extractor routing', async () => {
  // The memory extractor runs after the winner is chosen. Changing its tier
  // must not mutate the user-facing reply.
  const trace = await runTurnWithMemoryExtractorRouting();
  assert.equal(trace.assistantMessage, 'hi back!');
});
