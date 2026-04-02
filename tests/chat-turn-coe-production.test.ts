import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidateResponse } from '@/mastra/agents/generator';
import type { MemoryExtractionResult } from '@/mastra/agents/memory-extractor';
import { runChatTurn } from '@/mastra/workflows/chat-turn';
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
  TurnTrace,
  WorkingMemory,
} from '@/lib/schemas';
import {
  createCharacterVersion,
  createPairState,
  createPhaseNode,
  createPlan,
  createWorkingMemory,
} from './persona-test-helpers';

type ExecuteTurnInput = Parameters<typeof executeTurn>[0];
type ChatTurnDeps = NonNullable<Parameters<typeof runChatTurn>[1]>;

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
        supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
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

function applyPairUpdates(pairState: PairState, updates: Record<string, unknown>): PairState {
  return {
    ...pairState,
    activeCharacterVersionId:
      (updates.activeCharacterVersionId as string | undefined) ?? pairState.activeCharacterVersionId,
    activePhaseId: (updates.activePhaseId as string | undefined) ?? pairState.activePhaseId,
    affinity: (updates.affinity as number | undefined) ?? pairState.affinity,
    trust: (updates.trust as number | undefined) ?? pairState.trust,
    intimacyReadiness: (updates.intimacyReadiness as number | undefined) ?? pairState.intimacyReadiness,
    conflict: (updates.conflict as number | undefined) ?? pairState.conflict,
    emotion: (updates.emotion as PairState['emotion'] | undefined) ?? pairState.emotion,
    pad:
      (updates.pad as PairState['pad'] | undefined) ??
      ((updates.emotion as PairState['emotion'] | undefined)?.combined ?? pairState.pad),
    appraisal: (updates.appraisal as PairState['appraisal'] | undefined) ?? pairState.appraisal,
    openThreadCount: (updates.openThreadCount as number | undefined) ?? pairState.openThreadCount,
    lastTransitionAt:
      updates.lastTransitionAt === undefined
        ? pairState.lastTransitionAt
        : ((updates.lastTransitionAt as Date | null) ?? null),
    updatedAt: new Date('2026-03-25T00:00:00.000Z'),
  };
}

test('runChatTurn one-turn integration uses CoE pipeline and persists full pair metrics + PAD', async () => {
  const characterVersion = createCharacterVersion();
  const currentPhase = createPhaseNode();
  const phaseGraph = createPhaseGraph(currentPhase);
  const promptBundle = createPromptBundle();
  let pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: currentPhase.id,
    trust: 55,
    affinity: 58,
    conflict: 6,
    intimacyReadiness: 18,
    lastTransitionAt: new Date('2026-03-20T00:00:00.000Z'),
  });
  const pair = {
    id: pairState.pairId,
    userId: 'user-prod',
    characterId: characterVersion.characterId,
    canonicalThreadId: 'thread-prod',
    createdAt: new Date('2026-03-18T00:00:00.000Z'),
  };
  const recentTurns: Array<{ userMessageText: string; assistantMessageText: string; createdAt: Date }> = [];
  const countTurnsQueue = [9, 3];
  const countTurnsCalls: Array<{ pairId: string; since: Date | null }> = [];
  const pairUpdateCalls: Array<Record<string, unknown>> = [];
  const persistedTraces: TurnTrace[] = [];
  const executeTurnInputs: ExecuteTurnInput[] = [];
  const previousEmotionUpdatedAt = pairState.emotion.lastUpdatedAt;
  const workingMemory = createWorkingMemory();
  const { memoryStore } = createMemoryStoreFixture({ workingMemory });
  const extraction: CoEEvidenceExtractorResult = {
    interactionActs: [
      {
        act: 'compliment',
        target: 'character',
        polarity: 'positive',
        intensity: 0.78,
        evidenceSpans: [
          {
            source: 'user_message',
            sourceId: null,
            text: '今日すごく可愛いね',
            start: 0,
            end: 10,
          },
        ],
        confidence: 0.9,
        uncertaintyNotes: [],
      },
    ],
    relationalAppraisal: {
      warmthImpact: 0.74,
      rejectionImpact: -0.18,
      respectImpact: 0.52,
      threatImpact: -0.22,
      pressureImpact: 0.02,
      repairImpact: 0.16,
      reciprocityImpact: 0.48,
      intimacySignal: 0.42,
      boundarySignal: 0.46,
      certainty: 0.88,
    },
    confidence: 0.86,
    uncertaintyNotes: [],
  };

  const repos = {
    pairRepo: {
      async getOrCreate() {
        return pair;
      },
      async getState() {
        return pairState;
      },
      async initState() {
        throw new Error('initState should not be called in this integration test');
      },
      async updateState(_pairId: string, updates: Record<string, unknown>) {
        pairUpdateCalls.push(updates);
        pairState = applyPairUpdates(pairState, updates);
      },
    },
    traceRepo: {
      async getRecentTurns() {
        return recentTurns.slice(-10);
      },
      async countTurnsSince(pairId: string, since: Date | null) {
        countTurnsCalls.push({ pairId, since });
        return countTurnsQueue.shift() ?? 0;
      },
      async createChatTurn(input: {
        userMessageText: string;
        assistantMessageText: string;
      }) {
        recentTurns.push({
          userMessageText: input.userMessageText,
          assistantMessageText: input.assistantMessageText,
          createdAt: new Date('2026-03-25T00:00:00.000Z'),
        });
      },
      async createTrace(trace: TurnTrace) {
        persistedTraces.push(trace);
      },
    },
    characterRepo: {
      async getVersionById() {
        throw new Error('characterRepo.getVersionById should not be called with override');
      },
    },
    releaseRepo: {
      async getCurrent() {
        throw new Error('releaseRepo.getCurrent should not be called with override');
      },
    },
    phaseGraphRepo: {
      async getById() {
        throw new Error('phaseGraphRepo.getById should not be called with override');
      },
    },
    promptBundleRepo: {
      async getById() {
        throw new Error('promptBundleRepo.getById should not be called with override');
      },
    },
  };

  const result = await runChatTurn(
    {
      userId: pair.userId,
      characterId: characterVersion.characterId,
      message: '今日すごく可愛いね',
      characterVersionOverride: characterVersion,
      phaseGraphOverride: phaseGraph,
      promptBundleOverride: promptBundle,
    },
    {
      now: () => new Date('2026-03-25T00:00:00.000Z'),
      repos: repos as ChatTurnDeps['repos'],
      createMemoryStore: () => memoryStore,
      getOrCreateWorkingMemory: async () => workingMemory,
      executeTurn: async (input) => {
        executeTurnInputs.push(input);
        return executeTurn(input);
      },
      executeTurnDeps: {
        now: () => new Date('2026-03-25T00:00:00.000Z'),
        runCoEEvidenceExtractor: async () => ({
          extraction,
          modelId: 'mock/coe',
          systemPromptHash: 'coe-hash',
          attempts: 1,
        }),
        runPlanner: async () => ({
          plan: createPlan(),
          modelId: 'mock/planner',
          systemPromptHash: 'planner-hash',
        }),
        runGenerator: async () => ({
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
        }),
        runRanker: async (input) => ({
          winnerIndex: 0,
          candidates: createRankedCandidates(input.candidates),
          globalNotes: 'safe positive turn',
          modelId: 'mock/ranker',
          systemPromptHash: 'ranker-hash',
        }),
        runMemoryExtractor: async () => ({
          extraction: createMemoryExtraction(),
          modelId: 'mock/memory',
          systemPromptHash: 'memory-hash',
        }),
      },
    }
  );

  assert.equal(result.text.length > 0, true);
  assert.equal(executeTurnInputs.length, 1);
  assert.equal(executeTurnInputs[0].turnsSinceLastTransition, 9);
  assert.equal(executeTurnInputs[0].turnsSinceLastEmotionUpdate, 4);
  assert.equal(executeTurnInputs[0].daysSinceEntry, 5);
  assert.equal(countTurnsCalls.length, 2);
  assert.equal(countTurnsCalls[1].since?.toISOString(), previousEmotionUpdatedAt.toISOString());

  assert.equal(pairUpdateCalls.length, 1);
  assert.ok(pairUpdateCalls[0].trust !== undefined);
  assert.ok(pairUpdateCalls[0].affinity !== undefined);
  assert.ok(pairUpdateCalls[0].conflict !== undefined);
  assert.ok(pairUpdateCalls[0].intimacyReadiness !== undefined);
  assert.deepEqual(pairUpdateCalls[0].pad, (pairUpdateCalls[0].emotion as PairState['emotion']).combined);

  assert.equal(persistedTraces.length, 1);
  assert.equal(persistedTraces[0].coeExtraction?.interactionActs[0]?.act, 'compliment');
  assert.ok((persistedTraces[0].emotionTrace as any)?.relationalAppraisal.warmthImpact > 0);
  assert.ok((persistedTraces[0].emotionTrace as any)?.proposal.pairMetricDelta.trust > 0);
  assert.ok(persistedTraces[0].relationshipDeltas.trust > 0);
});

test('runChatTurn three-turn integration keeps CoE pipeline and non-placeholder elapsed values', async () => {
  const characterVersion = createCharacterVersion();
  const currentPhase = createPhaseNode();
  const phaseGraph = createPhaseGraph(currentPhase);
  const promptBundle = createPromptBundle();
  let pairState = createPairState({
    activeCharacterVersionId: characterVersion.id,
    activePhaseId: currentPhase.id,
    trust: 55,
    affinity: 58,
    conflict: 6,
    intimacyReadiness: 18,
    lastTransitionAt: new Date('2026-03-20T00:00:00.000Z'),
  });
  const pair = {
    id: pairState.pairId,
    userId: 'user-prod',
    characterId: characterVersion.characterId,
    canonicalThreadId: 'thread-prod',
    createdAt: new Date('2026-03-18T00:00:00.000Z'),
  };
  const recentTurns: Array<{ userMessageText: string; assistantMessageText: string; createdAt: Date }> = [];
  const countTurnsQueue = [4, 2, 5, 3, 6, 4];
  const persistedTraces: TurnTrace[] = [];
  const executeTurnInputs: ExecuteTurnInput[] = [];
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
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: '今すぐ答えてよ',
              start: 0,
              end: 8,
            },
          ],
          confidence: 0.9,
          uncertaintyNotes: [],
        },
      ],
      relationalAppraisal: {
        warmthImpact: -0.46,
        rejectionImpact: 0.34,
        respectImpact: -0.28,
        threatImpact: 0.48,
        pressureImpact: 0.82,
        repairImpact: -0.24,
        reciprocityImpact: -0.18,
        intimacySignal: 0.04,
        boundarySignal: -0.34,
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
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: 'さっきはごめん',
              start: 0,
              end: 7,
            },
          ],
          confidence: 0.92,
          uncertaintyNotes: [],
        },
      ],
      relationalAppraisal: {
        warmthImpact: 0.22,
        rejectionImpact: -0.18,
        respectImpact: 0.34,
        threatImpact: -0.22,
        pressureImpact: -0.12,
        repairImpact: 0.84,
        reciprocityImpact: 0.36,
        intimacySignal: 0.12,
        boundarySignal: 0.22,
        certainty: 0.89,
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
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: 'ちゃんと大事にしたい',
              start: 0,
              end: 11,
            },
          ],
          confidence: 0.88,
          uncertaintyNotes: [],
        },
      ],
      relationalAppraisal: {
        warmthImpact: 0.38,
        rejectionImpact: -0.08,
        respectImpact: 0.42,
        threatImpact: -0.16,
        pressureImpact: 0.04,
        repairImpact: 0.18,
        reciprocityImpact: 0.32,
        intimacySignal: 0.58,
        boundarySignal: 0.36,
        certainty: 0.86,
      },
      confidence: 0.86,
      uncertaintyNotes: [],
    },
  ];
  let extractionIndex = 0;

  const repos = {
    pairRepo: {
      async getOrCreate() {
        return pair;
      },
      async getState() {
        return pairState;
      },
      async initState() {
        throw new Error('initState should not be called in this integration test');
      },
      async updateState(_pairId: string, updates: Record<string, unknown>) {
        pairState = applyPairUpdates(pairState, updates);
      },
    },
    traceRepo: {
      async getRecentTurns() {
        return recentTurns.slice(-10);
      },
      async countTurnsSince() {
        return countTurnsQueue.shift() ?? 0;
      },
      async createChatTurn(input: {
        userMessageText: string;
        assistantMessageText: string;
      }) {
        recentTurns.push({
          userMessageText: input.userMessageText,
          assistantMessageText: input.assistantMessageText,
          createdAt: new Date('2026-03-25T00:00:00.000Z'),
        });
      },
      async createTrace(trace: TurnTrace) {
        persistedTraces.push(trace);
      },
    },
    characterRepo: {
      async getVersionById() {
        throw new Error('characterRepo.getVersionById should not be called with override');
      },
    },
    releaseRepo: {
      async getCurrent() {
        throw new Error('releaseRepo.getCurrent should not be called with override');
      },
    },
    phaseGraphRepo: {
      async getById() {
        throw new Error('phaseGraphRepo.getById should not be called with override');
      },
    },
    promptBundleRepo: {
      async getById() {
        throw new Error('promptBundleRepo.getById should not be called with override');
      },
    },
  };

  const nowValues = [
    new Date('2026-03-25T00:00:00.000Z'),
    new Date('2026-03-25T00:00:01.000Z'),
    new Date('2026-03-25T00:00:02.000Z'),
  ];
  let nowIndex = 0;
  const messages = ['今すぐ答えてよ', 'さっきはごめん', 'ちゃんと大事にしたい'];

  for (const message of messages) {
    await runChatTurn(
      {
        userId: pair.userId,
        characterId: characterVersion.characterId,
        message,
        characterVersionOverride: characterVersion,
        phaseGraphOverride: phaseGraph,
        promptBundleOverride: promptBundle,
      },
      {
        now: () => nowValues[nowIndex++] ?? nowValues[nowValues.length - 1],
        repos: repos as ChatTurnDeps['repos'],
        createMemoryStore: () => memoryStore,
        getOrCreateWorkingMemory: async () => workingMemory,
        executeTurn: async (input) => {
          executeTurnInputs.push(input);
          return executeTurn(input);
        },
        executeTurnDeps: {
          now: () => new Date('2026-03-25T00:00:00.000Z'),
          runCoEEvidenceExtractor: async () => ({
            extraction: extractions[extractionIndex++] ?? extractions[extractions.length - 1],
            modelId: 'mock/coe',
            systemPromptHash: `coe-hash-${extractionIndex}`,
            attempts: 1,
          }),
          runPlanner: async () => ({
            plan: createPlan(),
            modelId: 'mock/planner',
            systemPromptHash: 'planner-hash',
          }),
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
            systemPromptHash: 'generator-hash',
          }),
          runRanker: async (input) => ({
            winnerIndex: 0,
            candidates: createRankedCandidates(input.candidates),
            globalNotes: 'integration turn',
            modelId: 'mock/ranker',
            systemPromptHash: 'ranker-hash',
          }),
          runMemoryExtractor: async () => ({
            extraction: createMemoryExtraction(),
            modelId: 'mock/memory',
            systemPromptHash: 'memory-hash',
          }),
        },
      }
    );
  }

  assert.equal(executeTurnInputs.length, 3);
  assert.deepEqual(
    executeTurnInputs.map((item) => item.turnsSinceLastTransition),
    [4, 5, 6]
  );
  assert.deepEqual(
    executeTurnInputs.map((item) => item.turnsSinceLastEmotionUpdate),
    [3, 4, 5]
  );

  assert.ok(pairState.conflict > 0);
  assert.ok(pairState.trust > 0);
  assert.equal(persistedTraces.length, 3);
  assert.ok(
    persistedTraces.every((trace) => Boolean(trace.coeExtraction?.interactionActs.length))
  );
  assert.ok(
    persistedTraces.every((trace) => Boolean((trace.emotionTrace as any)?.proposal?.pairMetricDelta))
  );
});
