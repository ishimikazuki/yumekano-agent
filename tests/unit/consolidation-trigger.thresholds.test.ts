/**
 * T3: consolidation trigger threshold contract
 *
 * Locks in the salience-aware gating of `shouldTriggerConsolidation`:
 *
 *   1. No events → skip.
 *   2. High-salience activity triggers at the base threshold.
 *   3. Low-salience activity scales the threshold up (conservative).
 *
 * This ensures consolidation does not fire on "nothing meaningful happened"
 * sessions, keeping post-turn work off the hot path when it adds no value.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldTriggerConsolidation } from '@/mastra/workflows/consolidate-memory';
import type { MemoryStore } from '@/mastra/memory/store';
import type { MemoryEvent, WorkingMemory } from '@/lib/schemas';

const NOW = new Date('2026-04-21T00:00:00.000Z');

function emptyWM(): WorkingMemory {
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
}

function makeEvent(salience: number, idx: number): MemoryEvent {
  return {
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(idx).padStart(12, '0')}`,
    pairId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sourceTurnId: null,
    eventType: 'preference_shared',
    summary: `event ${idx}`,
    salience,
    retrievalKeys: [],
    emotionSignature: null,
    participants: ['user'],
    qualityScore: null,
    supersedesEventId: null,
    createdAt: NOW,
  } as MemoryEvent;
}

function makeStore(events: MemoryEvent[]): MemoryStore {
  return {
    async getWorkingMemory() { return emptyWM(); },
    async setWorkingMemory() {},
    getDefaultWorkingMemory() { return emptyWM(); },
    async getOpenThreads() { return []; },
    async getFacts() { return []; },
    async getFactsBySubject() { return []; },
    async getEvents(_, limit) { return events.slice(0, limit); },
    async getObservations() { return []; },
    async createEvent(input) { return { ...events[0], id: 'new' } as MemoryEvent; },
    async createFact() { throw new Error('not used'); },
    async createObservation() { throw new Error('not used'); },
    async createOrUpdateThread() { throw new Error('not used'); },
    async resolveThread() {},
    async updateEventQuality() {},
    async updateFactStatus() {},
    async updateObservationQuality() {},
    async createMemoryUsage(input) {
      return {
        id: 'u', memoryItemType: input.memoryItemType, memoryItemId: input.memoryItemId,
        turnId: input.turnId, wasSelected: input.wasSelected, wasHelpful: input.wasHelpful,
        scoreDelta: input.scoreDelta, createdAt: NOW,
      };
    },
  };
}

// --- tests ---

test('skips when no events have accumulated', async () => {
  const store = makeStore([]);
  const trigger = await shouldTriggerConsolidation({
    scopeId: 'pair-1',
    memoryStore: store,
    threshold: 5,
  });
  assert.equal(trigger, false, 'must not trigger with zero events');
});

test('skips when recent event count is below threshold', async () => {
  const store = makeStore(Array.from({ length: 3 }, (_, i) => makeEvent(0.8, i)));
  const trigger = await shouldTriggerConsolidation({
    scopeId: 'pair-1',
    memoryStore: store,
    threshold: 5,
  });
  assert.equal(trigger, false, 'must not trigger with fewer than threshold events');
});

test('triggers when recent activity is high-salience and count hits base threshold', async () => {
  // 5 high-salience events, threshold=5 → trigger.
  const store = makeStore(Array.from({ length: 5 }, (_, i) => makeEvent(0.8, i)));
  const trigger = await shouldTriggerConsolidation({
    scopeId: 'pair-1',
    memoryStore: store,
    threshold: 5,
  });
  assert.equal(trigger, true, 'high-salience activity must trigger at base threshold');
});

test('does NOT trigger when recent activity is low-salience and count is at base threshold', async () => {
  // 5 low-salience events, threshold=5 → do NOT trigger (requires 2x for low salience).
  const store = makeStore(Array.from({ length: 5 }, (_, i) => makeEvent(0.1, i)));
  const trigger = await shouldTriggerConsolidation({
    scopeId: 'pair-1',
    memoryStore: store,
    threshold: 5,
    salienceFloor: 0.3,
  });
  assert.equal(
    trigger,
    false,
    'low-salience activity must NOT trigger at base threshold — conservative scaling'
  );
});

test('eventually triggers on low-salience activity once the scaled threshold is reached', async () => {
  // 10 low-salience events, threshold=5 → reaches 2x → trigger.
  const store = makeStore(Array.from({ length: 10 }, (_, i) => makeEvent(0.1, i)));
  const trigger = await shouldTriggerConsolidation({
    scopeId: 'pair-1',
    memoryStore: store,
    threshold: 5,
    salienceFloor: 0.3,
  });
  assert.equal(
    trigger,
    true,
    'low-salience activity must eventually trigger once 2x threshold is reached'
  );
});

test('throws when neither scopeId nor pairId is provided', async () => {
  const store = makeStore([]);
  await assert.rejects(
    () => shouldTriggerConsolidation({ memoryStore: store, threshold: 5 }),
    /scopeId or pairId is required/
  );
});
