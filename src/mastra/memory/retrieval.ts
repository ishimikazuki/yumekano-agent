import {
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  MemoryPolicySpec,
} from '@/lib/schemas';
import type { MemoryStore } from './store';

export type RetrievalInput = {
  scopeId: string;
  userMessage: string;
  memoryPolicy: MemoryPolicySpec;
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  memoryStore: MemoryStore;
};

export type RetrievalResult = {
  events: MemoryEvent[];
  facts: MemoryFact[];
  observations: MemoryObservation[];
  threads: OpenThread[];
  retrievalNotes: string[];
};

/**
 * Multi-stage memory retrieval pipeline.
 *
 * Stages:
 * 1. Mandatory retrieval (open threads, recent corrections)
 * 2. Symbolic retrieval (graph facts by entity/predicate)
 * 3. Semantic retrieval (embeddings - simplified for MVP)
 * 4. Temporal reranking
 * 5. Quality reranking
 */
export async function retrieveMemory(input: RetrievalInput): Promise<RetrievalResult> {
  const { scopeId, userMessage, memoryPolicy, recentDialogue, memoryStore } = input;
  const notes: string[] = [];

  // Stage 1: Mandatory retrieval
  notes.push('Stage 1: Mandatory retrieval');
  const threads = await memoryStore.getOpenThreads(scopeId);
  notes.push(`Found ${threads.length} open threads`);

  // Stage 2: Symbolic retrieval - get active facts
  notes.push('Stage 2: Symbolic retrieval');
  const allFacts = await memoryStore.getFacts(scopeId, { status: 'active' });

  // Filter facts by relevance to message
  const relevantFacts = filterFactsByRelevance(
    allFacts,
    userMessage,
    recentDialogue,
    memoryPolicy.contradictionBoost
  );
  notes.push(`Filtered to ${relevantFacts.length} relevant facts from ${allFacts.length} total`);

  // Stage 3: Semantic retrieval (simplified - keyword matching for MVP)
  notes.push('Stage 3: Semantic retrieval (keyword-based for MVP)');
  const allEvents = await memoryStore.getEvents(scopeId, 100);
  const allObservations = await memoryStore.getObservations(scopeId, 50);

  const relevantEvents = filterEventsByRelevance(
    allEvents,
    userMessage,
    recentDialogue,
    memoryPolicy.retrievalTopK.episodes
  );
  notes.push(`Retrieved ${relevantEvents.length} relevant events`);

  const relevantObservations = filterObservationsByRelevance(
    allObservations,
    userMessage,
    memoryPolicy.retrievalTopK.observations
  );
  notes.push(`Retrieved ${relevantObservations.length} relevant observations`);

  // Stage 4: Temporal reranking
  notes.push('Stage 4: Temporal reranking');
  const rerankedEvents = temporalRerank(relevantEvents, memoryPolicy.recencyBias);
  const rerankedFacts = temporalRerank(relevantFacts, memoryPolicy.recencyBias);

  // Stage 5: Quality reranking
  notes.push('Stage 5: Quality reranking');
  const finalEvents = qualityRerank(rerankedEvents, memoryPolicy.qualityBias).slice(
    0,
    memoryPolicy.retrievalTopK.episodes
  );
  const finalFacts = rerankedFacts.slice(0, memoryPolicy.retrievalTopK.facts);
  const finalObservations = relevantObservations.slice(
    0,
    memoryPolicy.retrievalTopK.observations
  );

  return {
    events: finalEvents,
    facts: finalFacts,
    observations: finalObservations,
    threads,
    retrievalNotes: notes,
  };
}

/**
 * Filter facts by relevance to current message and dialogue.
 */
function filterFactsByRelevance(
  facts: MemoryFact[],
  message: string,
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>,
  contradictionBoost: number
): MemoryFact[] {
  const context = [
    message,
    ...recentDialogue.slice(-4).map((m) => m.content),
  ].join(' ').toLowerCase();

  return facts
    .map((fact) => {
      const subjectMatch = context.includes(fact.subject.toLowerCase());
      const predicateMatch = context.includes(fact.predicate.toLowerCase());
      const objectStr = JSON.stringify(fact.object).toLowerCase();
      const objectMatch = objectStr.split(/\s+/).some((word) => word.length > 2 && context.includes(word));
      const contradictionHint =
        /\b(ちがう|違う|じゃない|ではない|やめて|嫌い|苦手|not|don't)\b/i.test(context) &&
        fact.status !== 'superseded' &&
        (subjectMatch || predicateMatch || objectMatch);

      let score = 0;
      if (subjectMatch) score += 1;
      if (predicateMatch) score += 1;
      if (objectMatch) score += 1;
      if (contradictionHint) score += contradictionBoost;

      return { fact, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.fact);
}

/**
 * Filter events by relevance using keyword matching.
 * In production, this would use embedding similarity.
 */
function filterEventsByRelevance(
  events: MemoryEvent[],
  message: string,
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>,
  limit: number
): MemoryEvent[] {
  const context = [
    message,
    ...recentDialogue.slice(-4).map((m) => m.content),
  ].join(' ').toLowerCase();

  const scored = events.map((event) => {
    let score = event.salience;

    // Keyword matching
    for (const key of event.retrievalKeys) {
      if (context.includes(key.toLowerCase())) {
        score += 0.2;
      }
    }

    // Summary matching
    const summaryWords = event.summary.toLowerCase().split(/\s+/);
    for (const word of summaryWords) {
      if (word.length > 2 && context.includes(word)) {
        score += 0.05;
      }
    }

    return { event, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 2) // Get more than needed for later filtering
    .map((s) => s.event);
}

/**
 * Filter observations by relevance.
 */
function filterObservationsByRelevance(
  observations: MemoryObservation[],
  message: string,
  limit: number
): MemoryObservation[] {
  const messageLower = message.toLowerCase();

  const scored = observations.map((obs) => {
    let score = obs.salience;

    // Keyword matching
    for (const key of obs.retrievalKeys) {
      if (messageLower.includes(key.toLowerCase())) {
        score += 0.3;
      }
    }

    return { obs, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.obs);
}

/**
 * Rerank items by recency.
 */
function temporalRerank<T extends { createdAt: Date }>(
  items: T[],
  recencyBias: number
): T[] {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  return [...items].sort((a, b) => {
    const aAge = (now - new Date(a.createdAt).getTime()) / hourMs;
    const bAge = (now - new Date(b.createdAt).getTime()) / hourMs;

    // Newer items get a boost proportional to recencyBias
    const aScore = Math.exp(-aAge * recencyBias * 0.01);
    const bScore = Math.exp(-bAge * recencyBias * 0.01);

    return bScore - aScore;
  });
}

/**
 * Rerank items by quality score.
 */
function qualityRerank(
  events: MemoryEvent[],
  qualityBias: number
): MemoryEvent[] {
  return [...events].sort((a, b) => {
    const aQuality = a.qualityScore ?? 0.5;
    const bQuality = b.qualityScore ?? 0.5;

    // Combine with existing order
    const aScore = aQuality * qualityBias;
    const bScore = bQuality * qualityBias;

    return bScore - aScore;
  });
}

/**
 * Get working memory for a pair, or create default.
 */
export async function getOrCreateWorkingMemory(scopeId: string, memoryStore: MemoryStore) {
  const existing = await memoryStore.getWorkingMemory(scopeId);
  if (existing) return existing;

  const defaultMemory = memoryStore.getDefaultWorkingMemory();
  await memoryStore.setWorkingMemory(scopeId, defaultMemory);
  return defaultMemory;
}
