import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateResponse } from '@/mastra/agents/generator';
import type { MemoryExtractionResult } from '@/mastra/agents/memory-extractor';
import { executeTurn } from '@/mastra/workflows/execute-turn';
import type { MemoryStore } from '@/mastra/memory/store';
import type {
  Candidate,
  CoEEvidenceExtractorResult,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  PairState,
  PhaseGraph,
  PhaseNode,
  PromptBundleVersion,
  WorkingMemory,
} from '@/lib/schemas';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createPlan,
  createWorkingMemory,
} from './persona-test-helpers';

function createPromptBundle(): PromptBundleVersion {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    characterId: '22222222-2222-4222-8222-222222222222',
    versionNumber: 1,
    plannerMd: 'planner prelude',
    generatorMd: 'generator prelude',
    generatorIntimacyMd: 'intimacy generator prelude',
    emotionAppraiserMd: '',
    extractorMd: 'memory extractor prelude',
    reflectorMd: '',
    rankerMd: 'ranker prelude',
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
  };
}

function createPhaseGraph(node: PhaseNode): PhaseGraph {
  return {
    entryPhaseId: node.id,
    nodes: [node],
    edges: [],
  };
}

function createObservation(): MemoryObservation {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    pairId: '55555555-5555-4555-8555-555555555555',
    summary: 'She relaxes when the user explicitly paces closeness and stays consistent.',
    retrievalKeys: ['pacing', 'consistent'],
    salience: 0.7,
    qualityScore: null,
    windowStartAt: new Date('2026-03-20T00:00:00.000Z'),
    windowEndAt: new Date('2026-03-24T00:00:00.000Z'),
    createdAt: new Date('2026-03-24T00:00:00.000Z'),
  };
}

function createMemoryStoreFixture(input?: {
  workingMemory?: WorkingMemory;
  facts?: MemoryFact[];
  events?: MemoryEvent[];
  observations?: MemoryObservation[];
  threads?: OpenThread[];
}) {
  const state = {
    workingMemory: input?.workingMemory ?? createWorkingMemory(),
    facts: input?.facts ?? [],
    events: input?.events ?? [],
    observations: input?.observations ?? [createObservation()],
    threads: input?.threads ?? [],
    memoryUsage: [] as Array<{ turnId: string; memoryItemId: string }>,
  };
  let idCounter = 0;
  const nextId = (prefix: string) =>
    `${prefix}${String(++idCounter).padStart(11, '0')}`.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,
      '$1-$2-4$3-8$4-$5'
    );

  const memoryStore: MemoryStore = {
    async getWorkingMemory() {
      return state.workingMemory;
    },
    async setWorkingMemory(_scopeId, data) {
      state.workingMemory = data;
    },
    getDefaultWorkingMemory() {
      return createWorkingMemory();
    },
    async getOpenThreads() {
      return state.threads.filter((thread) => thread.status === 'open');
    },
    async getFacts() {
      return state.facts.filter((fact) => fact.status === 'active');
    },
    async getFactsBySubject(_scopeId, subject) {
      return state.facts.filter((fact) => fact.subject === subject);
    },
    async getEvents(_scopeId, limit = 100) {
      return state.events.slice(-limit);
    },
    async getObservations(_scopeId, limit = 50) {
      return state.observations.slice(-limit);
    },
    async createEvent(input) {
      const event: MemoryEvent = {
        id: nextId('event'),
        pairId: input.scopeId,
        sourceTurnId: input.sourceTurnId,
        eventType: input.eventType,
        summary: input.summary,
        salience: input.salience,
        retrievalKeys: input.retrievalKeys,
        emotionSignature: input.emotionSignature,
        participants: input.participants,
        qualityScore: null,
        supersedesEventId: input.supersedesEventId ?? null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.events.push(event);
      return event;
    },
    async createFact(input) {
      const fact: MemoryFact = {
        id: nextId('fact'),
        pairId: input.scopeId,
        subject: input.subject,
        predicate: input.predicate,
        object: input.object,
        confidence: input.confidence,
        status: 'active',
        supersededByFactId: null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.facts.push(fact);
      return fact;
    },
    async createObservation(input) {
      const observation: MemoryObservation = {
        id: nextId('observation'),
        pairId: input.scopeId,
        summary: input.summary,
        retrievalKeys: input.retrievalKeys,
        salience: input.salience,
        qualityScore: null,
        windowStartAt: input.windowStartAt,
        windowEndAt: input.windowEndAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.observations.push(observation);
      return observation;
    },
    async createOrUpdateThread(input) {
      const existing = state.threads.find((thread) => thread.key === input.key);
      if (existing) {
        existing.summary = input.summary;
        existing.severity = input.severity;
        existing.status = 'open';
        existing.updatedAt = new Date('2026-03-25T00:00:00.000Z');
        return existing;
      }

      const thread: OpenThread = {
        id: nextId('thread'),
        pairId: input.scopeId,
        key: input.key,
        summary: input.summary,
        severity: input.severity,
        status: 'open',
        openedByEventId: input.openedByEventId ?? null,
        resolvedByEventId: null,
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.threads.push(thread);
      return thread;
    },
    async resolveThread(_scopeId, key, resolvedByEventId) {
      const thread = state.threads.find((item) => item.key === key);
      if (thread) {
        thread.status = 'resolved';
        thread.resolvedByEventId = resolvedByEventId ?? null;
      }
    },
    async updateEventQuality() {},
    async updateFactStatus(factId, status) {
      const fact = state.facts.find((item) => item.id === factId);
      if (fact) {
        fact.status = status;
      }
    },
    async updateObservationQuality(observationId, qualityScore) {
      const observation = state.observations.find((item) => item.id === observationId);
      if (observation) {
        observation.qualityScore = qualityScore;
      }
    },
    async createMemoryUsage(input) {
      state.memoryUsage.push({
        turnId: input.turnId,
        memoryItemId: input.memoryItemId,
      });
      return {
        id: nextId('usage'),
        memoryItemType: input.memoryItemType,
        memoryItemId: input.memoryItemId,
        turnId: input.turnId,
        wasSelected: input.wasSelected,
        wasHelpful: input.wasHelpful,
        scoreDelta: input.scoreDelta,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
    },
  };

  return { memoryStore, state };
}

function createRankedCandidates(candidates: CandidateResponse[]): Candidate[] {
  return candidates.map((candidate, index) => ({
    index,
    text: candidate.text,
    toneTags: candidate.toneTags,
    memoryRefsUsed: candidate.memoryRefsUsed,
    riskFlags: candidate.riskFlags,
    scores: {
      personaConsistency: 0.85,
      phaseCompliance: 0.88,
      memoryGrounding: 0.8,
      emotionalCoherence: 0.86,
      autonomy: 0.84,
      naturalness: 0.82,
      overall: 0.86 - index * 0.02,
    },
    rejected: false,
    rejectionReason: null,
  }));
}

function createMemoryExtraction(): MemoryExtractionResult {
  return {
    workingMemoryPatch: {},
    episodicEvents: [],
    graphFacts: [],
    openThreadUpdates: [],
    extractionNotes: 'none',
  };
}

function createTurnInput(overrides?: Partial<PairState>) {
  const characterVersion = createCharacterVersion();
  const currentPhase = createPhaseNode();
  const pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: currentPhase.id,
    ...overrides,
  });

  return {
    characterVersion,
    currentPhase,
    pairState,
    phaseGraph: createPhaseGraph(currentPhase),
    promptBundle: createPromptBundle(),
  };
}

test('Task T4 one-turn production flow injects canonical CoE context and persists updated pair metrics', async () => {
  const { characterVersion, currentPhase, pairState, phaseGraph, promptBundle } =
    createTurnInput();
  const workingMemory = createWorkingMemory();
  const { memoryStore } = createMemoryStoreFixture({ workingMemory });
  let persistedPairState = null as PairState | null;
  let plannerSawContext = false;
  let generatorSawContext = false;
  let rankerSawContext = false;
  const extraction: CoEEvidenceExtractorResult = {
    interactionActs: [
      {
        act: 'compliment',
        target: 'character',
        polarity: 'positive',
        intensity: 0.78,
        confidence: 0.9,
        evidenceSpans: [
          {
            source: 'user_message',
            sourceId: null,
            text: '今日すごく可愛いね',
            start: 0,
            end: 10,
          },
        ],
        uncertaintyNotes: [],
      },
    ],
    relationalAppraisal: {
      warmthImpact: 0.82,
      rejectionImpact: -0.1,
      respectImpact: 0.4,
      threatImpact: -0.1,
      pressureImpact: -0.05,
      repairImpact: 0.1,
      reciprocityImpact: 0.35,
      intimacySignal: 0.22,
      boundarySignal: 0.3,
      certainty: 0.9,
    },
    confidence: 0.88,
    uncertaintyNotes: [],
  };

  const result = await executeTurn({
    scopeId: pairState.pairId,
    tracePairId: pairState.pairId,
    traceCharacterVersionId: characterVersion.id,
    tracePromptBundleVersionId: promptBundle.id,
    threadId: 'thread-one',
    userMessage: '今日すごく可愛いね。会えてうれしい',
    characterVersion,
    phaseGraph,
    promptBundle,
    pairState,
    currentPhase,
    workingMemory,
    recentDialogue: [],
    turnsSinceLastTransition: 1,
    daysSinceEntry: 2,
    turnsSinceLastEmotionUpdate: 1,
    memoryStore,
    persistence: {
      async createTurnRecord() {},
      async persistTrace() {},
      async updatePairState(nextState) {
        persistedPairState = nextState;
      },
    },
    deps: {
      now: () => new Date('2026-03-25T00:00:00.000Z'),
      runCoEEvidenceExtractor: async (input: any) => {
        assert.equal(input.retrievedMemory.observations.length, 1);
        return {
          extraction,
          modelId: 'mock/coe',
          systemPromptHash: 'coe-hash',
          attempts: 1,
        };
      },
      runPlanner: async (input: any) => {
        plannerSawContext =
          input.retrievedMemory.observations.length === 1 &&
          input.emotionContext?.coeExtraction.interactionActs[0]?.act === 'compliment' &&
          (input.emotionContext?.emotionTrace.relationalAppraisal.warmthImpact ?? 0) > 0 &&
          (input.emotionContext?.emotionTrace.proposal.pairMetricDelta.trust ?? 0) > 0 &&
          (input.emotionContext?.emotionTrace.proposal.padDelta.pleasure ?? 0) > 0;
        return {
          plan: createPlan(),
          modelId: 'mock/planner',
          systemPromptHash: 'planner-hash',
        };
      },
      runGenerator: async (input: any) => {
        generatorSawContext =
          (input.emotionContext?.emotionTrace.evidence[0]?.acts?.[0] ?? '') === 'compliment' &&
          input.retrievedMemory.observations.length === 1;
        return {
          candidates: [
            {
              text: 'えへへ、そう言ってもらえるとうれしいよ。',
              toneTags: ['warm'],
              memoryRefsUsed: [],
              riskFlags: [],
            },
          ],
          modelId: 'mock/generator',
          systemPromptHash: 'generator-hash',
        };
      },
      runRanker: async (input: any) => {
        rankerSawContext =
          (input.emotionContext?.emotionTrace.emotionAfter.pleasure ?? 0) >
            (input.emotionContext?.emotionTrace.emotionBefore.pleasure ?? 0) &&
          input.retrievedMemory.observations.length === 1;
        return {
          winnerIndex: 0,
          candidates: createRankedCandidates(input.candidates),
          globalNotes: 'safe positive turn',
          modelId: 'mock/ranker',
          systemPromptHash: 'ranker-hash',
        };
      },
      runMemoryExtractor: async () => ({
        extraction: createMemoryExtraction(),
        modelId: 'mock/memory',
        systemPromptHash: 'memory-hash',
      }),
    } as any,
  } as any);

  assert.equal(plannerSawContext, true);
  assert.equal(generatorSawContext, true);
  assert.equal(rankerSawContext, true);
  assert.ok((result.trace.coeExtraction?.relationalAppraisal.warmthImpact ?? 0) > 0.5);
  assert.ok(((result.trace.emotionTrace as any)?.relationalAppraisal.warmthImpact ?? 0) > 0.5);
  assert.ok(((result.trace.emotionTrace as any)?.proposal.pairMetricDelta.trust ?? 0) > 0);
  assert.ok(persistedPairState);
  assert.equal(persistedPairState?.trust, result.pairState.trust);
  assert.equal(persistedPairState?.affinity, result.pairState.affinity);
  assert.equal(persistedPairState?.conflict, result.pairState.conflict);
  assert.equal(
    persistedPairState?.intimacyReadiness,
    result.pairState.intimacyReadiness
  );
  assert.equal(result.trace.legacyComparison ?? null, null);
});

test('Task T4 three-turn production progression keeps canonical CoE state and no longer emits legacy diff even if the old flag is enabled', async () => {
  const previousFlag = process.env.YUMEKANO_USE_COE_INTEGRATOR;
  process.env.YUMEKANO_USE_COE_INTEGRATOR = 'true';

  try {
    const { characterVersion, currentPhase, phaseGraph, promptBundle } = createTurnInput({
      trust: 55,
      affinity: 58,
      conflict: 6,
      intimacyReadiness: 18,
    });
    const workingMemory = createWorkingMemory();
    const { memoryStore } = createMemoryStoreFixture({ workingMemory });
    const extractions: CoEEvidenceExtractorResult[] = [
      {
        interactionActs: [
          {
            act: 'pressure',
            target: 'boundary',
            polarity: 'negative',
            intensity: 0.84,
            confidence: 0.9,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: '今すぐ答えてよ',
                start: 0,
                end: 8,
              },
            ],
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: -0.4,
          rejectionImpact: 0.2,
          respectImpact: -0.55,
          threatImpact: 0.4,
          pressureImpact: 0.9,
          repairImpact: -0.2,
          reciprocityImpact: -0.25,
          intimacySignal: 0.05,
          boundarySignal: -0.45,
          certainty: 0.9,
        },
        confidence: 0.88,
        uncertaintyNotes: [],
      },
      {
        interactionActs: [
          {
            act: 'apology',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.78,
            confidence: 0.92,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: 'さっきはごめん',
                start: 0,
                end: 7,
              },
            ],
            uncertaintyNotes: [],
          },
          {
            act: 'repair',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.74,
            confidence: 0.86,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: '急がせたくなかった',
                start: 8,
                end: 18,
              },
            ],
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.24,
          rejectionImpact: -0.15,
          respectImpact: 0.3,
          threatImpact: -0.22,
          pressureImpact: -0.1,
          repairImpact: 0.88,
          reciprocityImpact: 0.36,
          intimacySignal: 0.12,
          boundarySignal: 0.18,
          certainty: 0.9,
        },
        confidence: 0.89,
        uncertaintyNotes: [],
      },
      {
        interactionActs: [
          {
            act: 'affection',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.7,
            confidence: 0.88,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: 'ちゃんと大事にしたい',
                start: 0,
                end: 11,
              },
            ],
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.48,
          rejectionImpact: -0.08,
          respectImpact: 0.36,
          threatImpact: -0.1,
          pressureImpact: -0.06,
          repairImpact: 0.18,
          reciprocityImpact: 0.3,
          intimacySignal: 0.56,
          boundarySignal: 0.28,
          certainty: 0.87,
        },
        confidence: 0.86,
        uncertaintyNotes: [],
      },
    ];
    const seenCanonicalAxes: Array<number | null> = [];
    let pairState = createPairState({
      activeCharacterVersionId: characterVersion.id,
      activePhaseId: currentPhase.id,
      trust: 55,
      affinity: 58,
      conflict: 6,
      intimacyReadiness: 18,
    });
    let recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const results = [];

    for (const [index, extraction] of extractions.entries()) {
      const result = await executeTurn({
        scopeId: pairState.pairId,
        tracePairId: pairState.pairId,
        traceCharacterVersionId: characterVersion.id,
        tracePromptBundleVersionId: promptBundle.id,
        threadId: 'thread-three',
        userMessage:
          index === 0
            ? '今すぐ答えてよ'
            : index === 1
              ? 'さっきはごめん。急がせたくなかった'
              : 'ちゃんと大事にしたい。無理なら待つよ',
        characterVersion,
        phaseGraph,
        promptBundle,
        pairState,
        currentPhase,
        workingMemory,
        recentDialogue,
        turnsSinceLastTransition: index + 1,
        daysSinceEntry: 2,
        turnsSinceLastEmotionUpdate: 1,
        memoryStore,
        persistence: {
          async createTurnRecord() {},
          async persistTrace() {},
          async updatePairState(nextState) {
            pairState = nextState;
          },
        },
        deps: {
          now: () => new Date(`2026-03-25T00:00:0${index}.000Z`),
          runCoEEvidenceExtractor: async () => ({
            extraction,
            modelId: 'mock/coe',
            systemPromptHash: `coe-hash-${index}`,
            attempts: 1,
          }),
          runPlanner: async (input: any) => {
            seenCanonicalAxes.push(
              input.emotionContext?.emotionTrace?.relationalAppraisal?.pressureImpact ??
                input.emotionContext?.emotionTrace?.relationalAppraisal?.repairImpact ??
                input.emotionContext?.emotionTrace?.relationalAppraisal?.intimacySignal ??
                null
            );
            return {
              plan: createPlan(),
              modelId: 'mock/planner',
              systemPromptHash: `planner-hash-${index}`,
            };
          },
          runGenerator: async () => ({
            candidates: [
              {
                text: 'うん、ちゃんと話そう。',
                toneTags: ['steady'],
                memoryRefsUsed: [],
                riskFlags: [],
              },
            ],
            modelId: 'mock/generator',
            systemPromptHash: `generator-hash-${index}`,
          }),
          runRanker: async (input: any) => ({
            winnerIndex: 0,
            candidates: createRankedCandidates(input.candidates),
            globalNotes: `turn-${index}`,
            modelId: 'mock/ranker',
            systemPromptHash: `ranker-hash-${index}`,
          }),
          runMemoryExtractor: async () => ({
            extraction: createMemoryExtraction(),
            modelId: 'mock/memory',
            systemPromptHash: `memory-hash-${index}`,
          }),
        } as any,
      } as any);

      results.push(result);
      recentDialogue = [
        ...recentDialogue,
        { role: 'user', content: result.trace.userMessage },
        { role: 'assistant', content: result.trace.assistantMessage },
      ];
    }

    assert.ok(results[0].pairState.conflict > 6);
    assert.ok(results[0].pairState.trust < 55);
    assert.ok(results[1].pairState.trust > results[0].pairState.trust);
    assert.ok(results[1].pairState.conflict < results[0].pairState.conflict);
    assert.ok(
      results[2].pairState.intimacyReadiness >= results[1].pairState.intimacyReadiness
    );
    assert.ok(results.every((result) => (result.trace.legacyComparison ?? null) === null));
    assert.equal(seenCanonicalAxes.length, 3);
    assert.ok(seenCanonicalAxes.every((value) => value !== null));
    assert.ok(
      ((results[0].trace.emotionTrace as any)?.relationalAppraisal.pressureImpact ?? 0) > 0.6
    );
    assert.ok(
      ((results[1].trace.emotionTrace as any)?.relationalAppraisal.repairImpact ?? 0) > 0.7
    );
    assert.ok(
      ((results[2].trace.emotionTrace as any)?.relationalAppraisal.intimacySignal ?? 0) > 0.5
    );
  } finally {
    if (previousFlag === undefined) {
      delete process.env.YUMEKANO_USE_COE_INTEGRATOR;
    } else {
      process.env.YUMEKANO_USE_COE_INTEGRATOR = previousFlag;
    }
  }
});
