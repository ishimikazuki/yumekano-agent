import test from 'node:test';
import assert from 'node:assert/strict';
import { processMemoryWrites } from '@/mastra/memory/writeback';
import { shouldTriggerConsolidation } from '@/mastra/workflows/consolidate-memory';
import type {
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  WorkingMemory,
  MemoryFactStatus,
  PADState,
  MemoryUsage,
} from '@/lib/schemas';
import type { MemoryStore } from '@/mastra/memory/store';

function createStubMemoryStore(): MemoryStore & {
  facts: MemoryFact[];
  events: MemoryEvent[];
  observations: MemoryObservation[];
  threads: OpenThread[];
  workingMemory: WorkingMemory | null;
} {
  const facts: MemoryFact[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      pairId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      subject: 'user',
      predicate: 'likes',
      object: 'coffee',
      confidence: 0.8,
      status: 'active',
      supersedesFactId: null,
      sourceEventId: null,
      createdAt: new Date(),
    },
  ];
  const events: MemoryEvent[] = [];
  const observations: MemoryObservation[] = [];
  const threads: OpenThread[] = [];
  let workingMemory: WorkingMemory | null = null;

  return {
    facts,
    events,
    observations,
    threads,
    workingMemory,
    async getWorkingMemory() {
      return workingMemory;
    },
    async setWorkingMemory(_scopeId, data) {
      workingMemory = data;
    },
    getDefaultWorkingMemory() {
      return {
        preferredAddressForm: null,
        knownLikes: [],
        knownDislikes: [],
        currentCooldowns: {},
        activeTensionSummary: null,
        relationshipStance: null,
        knownCorrections: [],
        intimacyContextHints: [],
      };
    },
    async getOpenThreads() {
      return threads;
    },
    async getFacts() {
      return facts;
    },
    async getFactsBySubject(_scopeId, subject) {
      return facts.filter((fact) => fact.subject === subject);
    },
    async getEvents(_scopeId, limit = 50) {
      return events.slice(0, limit);
    },
    async getObservations(_scopeId, limit = 20) {
      return observations.slice(0, limit);
    },
    async createEvent(input) {
      const created: MemoryEvent = {
        id: '22222222-2222-2222-2222-222222222222',
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
        createdAt: new Date(),
      };
      events.unshift(created);
      return created;
    },
    async createFact(input) {
      const created: MemoryFact = {
        id: '33333333-3333-3333-3333-333333333333',
        pairId: input.scopeId,
        subject: input.subject,
        predicate: input.predicate,
        object: input.object,
        confidence: input.confidence,
        status: 'active',
        supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        createdAt: new Date(),
      };
      if (input.supersedesFactId) {
        const existing = facts.find((fact) => fact.id === input.supersedesFactId);
        if (existing) existing.status = 'superseded';
      }
      facts.unshift(created);
      return created;
    },
    async createObservation(input) {
      const created: MemoryObservation = {
        id: '44444444-4444-4444-4444-444444444444',
        pairId: input.scopeId,
        summary: input.summary,
        retrievalKeys: input.retrievalKeys,
        salience: input.salience,
        qualityScore: null,
        windowStartAt: input.windowStartAt,
        windowEndAt: input.windowEndAt,
        createdAt: new Date(),
      };
      observations.unshift(created);
      return created;
    },
    async createOrUpdateThread(input) {
      const existing = threads.find((thread) => thread.key === input.key);
      if (existing) {
        existing.summary = input.summary;
        existing.severity = input.severity;
        existing.status = 'open';
        existing.updatedAt = new Date();
        return existing;
      }

      const created: OpenThread = {
        id: '55555555-5555-5555-5555-555555555555',
        pairId: input.scopeId,
        key: input.key,
        summary: input.summary,
        severity: input.severity,
        status: 'open',
        openedByEventId: input.openedByEventId ?? null,
        resolvedByEventId: null,
        updatedAt: new Date(),
      };
      threads.unshift(created);
      return created;
    },
    async resolveThread(_scopeId, key) {
      const existing = threads.find((thread) => thread.key === key);
      if (existing) existing.status = 'resolved';
    },
    async updateEventQuality() {},
    async updateFactStatus(factId, status) {
      const existing = facts.find((fact) => fact.id === factId);
      if (existing) existing.status = status;
    },
    async updateObservationQuality() {},
    async createMemoryUsage(input) {
      return {
        id: '66666666-6666-6666-6666-666666666666',
        memoryItemType: input.memoryItemType,
        memoryItemId: input.memoryItemId,
        turnId: input.turnId,
        wasSelected: input.wasSelected,
        wasHelpful: input.wasHelpful,
        scoreDelta: input.scoreDelta,
        createdAt: new Date(),
      } satisfies MemoryUsage;
    },
  };
}

test('processMemoryWrites applies thresholds, sourceTurnId, supersession, and working memory patch', async () => {
  const store = createStubMemoryStore();
  const sourceTurnId = '77777777-7777-7777-7777-777777777777';
  const currentWorkingMemory = store.getDefaultWorkingMemory();

  const result = await processMemoryWrites({
    memoryStore: store,
    scopeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sourceTurnId,
    currentWorkingMemory,
    memoryPolicy: {
      eventSalienceThreshold: 0.5,
      factConfidenceThreshold: 0.6,
      observationCompressionTarget: 256,
      retrievalTopK: { episodes: 5, facts: 5, observations: 5 },
      recencyBias: 0.5,
      qualityBias: 0.5,
      contradictionBoost: 1.2,
    },
    extraction: {
      workingMemoryPatch: {
        addLikes: ['抹茶'],
        relationshipStance: 'closer',
      },
      episodicEvents: [
        {
          eventType: 'gift',
          summary: '抹茶ラテをくれた',
          salience: 0.9,
          retrievalKeys: ['抹茶', 'ラテ'],
          emotionSignature: { pleasure: 0.4, arousal: 0.1, dominance: 0.2 } satisfies PADState,
          participants: ['user', 'character'],
        },
      ],
      graphFacts: [
        {
          subject: 'user',
          predicate: 'likes',
          object: 'matcha',
          confidence: 0.92,
          supersedesExisting: true,
        },
      ],
      openThreadUpdates: [
        {
          key: 'reply-later',
          action: 'open',
          summary: '返事待ち',
          severity: 0.7,
        },
      ],
      extractionNotes: 'ok',
    },
  });

  assert.equal(result.thresholdDecisions.length, 2);
  assert.equal(result.writes.every((write) => write.sourceTurnId === sourceTurnId), true);
  assert.equal(store.events.length, 1);
  assert.equal(store.facts[0].supersedesFactId, '11111111-1111-1111-1111-111111111111');
  assert.equal(store.facts[1].status, 'superseded');
  assert.deepEqual(result.workingMemory.knownLikes, ['抹茶']);
  assert.equal(result.workingMemory.relationshipStance, 'closer');
  assert.equal(store.threads.length, 1);
});

test('shouldTriggerConsolidation uses injected memory store threshold', async () => {
  const store = createStubMemoryStore();
  store.events.push(
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `88888888-8888-8888-8888-${String(index).padStart(12, '0')}`,
      pairId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      sourceTurnId: null,
      eventType: 'chat',
      summary: `event ${index}`,
      salience: 0.5,
      retrievalKeys: [`event-${index}`],
      emotionSignature: null,
      participants: ['user', 'character'],
      qualityScore: null,
      supersedesEventId: null,
      createdAt: new Date(),
    }))
  );

  const triggered = await shouldTriggerConsolidation({
    scopeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    memoryStore: store,
    threshold: 30,
  });

  assert.equal(triggered, true);
});
