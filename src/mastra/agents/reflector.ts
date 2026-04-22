import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type {
  CharacterVersion,
  PairState,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
} from '@/lib/schemas';

const ReflectionOutputSchema = z.object({
  newObservations: z.array(
    z.object({
      summary: z.string(),
      retrievalKeys: z.array(z.string()),
      salience: z.number().min(0).max(1),
    })
  ),
  threadUpdates: z.array(
    z.object({
      key: z.string(),
      action: z.enum(['resolve', 'escalate', 'update']),
      newSummary: z.string().optional(),
      newSeverity: z.number().min(0).max(1).optional(),
      reason: z.string(),
    })
  ),
  factMerges: z.array(
    z.object({
      factIds: z.array(z.string()),
      mergedFact: z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.any().default(null),
        confidence: z.number().min(0).max(1),
      }),
      reason: z.string(),
    })
  ),
  qualityLabels: z.array(
    z.object({
      itemId: z.string(),
      itemType: z.enum(['event', 'fact', 'observation']),
      newQualityScore: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
  reflectionSummary: z.string(),
});

export type ReflectorInput = {
  characterVersion: CharacterVersion;
  pairState: PairState;
  recentEvents: MemoryEvent[];
  existingObservations: MemoryObservation[];
  existingOpenThreads: OpenThread[];
  existingGraphFacts: MemoryFact[];
  promptOverride?: string;
};

export type ReflectorOutput = {
  newObservations: Array<{
    summary: string;
    retrievalKeys: string[];
    salience: number;
  }>;
  threadUpdates: Array<{
    key: string;
    action: 'resolve' | 'escalate' | 'update';
    newSummary?: string;
    newSeverity?: number;
    reason: string;
  }>;
  factMerges: Array<{
    factIds: string[];
    mergedFact: {
      subject: string;
      predicate: string;
      object?: unknown;
      confidence: number;
    };
    reason: string;
  }>;
  qualityLabels: Array<{
    itemId: string;
    itemType: 'event' | 'fact' | 'observation';
    newQualityScore: number;
    reason: string;
  }>;
  reflectionSummary: string;
  modelId: string;
};

/**
 * The Reflector agent consolidates recent memory into denser long-term artifacts.
 */
export async function runReflector(input: ReflectorInput): Promise<ReflectorOutput> {
  const registry = getProviderRegistry();
  const model = registry.getModel('maintenanceFast');
  const modelInfo = registry.getModelInfo('maintenanceFast');

  const systemPrompt = buildReflectorSystemPrompt(input);
  const userPrompt = buildReflectorUserPrompt(input);

  const result = await generateObject({
    model,
    schema: ReflectionOutputSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return {
    ...result.object,
    modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
  };
}

function buildReflectorSystemPrompt(input: ReflectorInput): string {
  const { characterVersion, promptOverride } = input;

  if (promptOverride) {
    return promptOverride;
  }

  return `# Reflection System Prompt

You consolidate recent conversation memory into denser long-term artifacts.

## Character Context
${characterVersion.persona.summary}

## Memory Policy
- Event Salience Threshold: ${characterVersion.memory.eventSalienceThreshold}
- Fact Confidence Threshold: ${characterVersion.memory.factConfidenceThreshold}
- Observation Compression Target: ${characterVersion.memory.observationCompressionTarget} tokens

## Principles
1. **Compress without erasing what matters**
   - Important emotional moments should remain retrievable
   - Repeated patterns should be summarized, not listed

2. **Merge duplicates**
   - Same fact from multiple sources → single high-confidence fact
   - Similar observations → combined observation

3. **Keep contradictions visible**
   - Don't hide superseded facts, mark them appropriately
   - Track when corrections happened

4. **Summarize patterns, not transcripts**
   - "User often asks about X" not "Turn 1: asked X, Turn 5: asked X..."
   - Relationship trends, not conversation logs

5. **Track relationship trends and unresolved issues**
   - What threads remain open?
   - What issues were resolved?
   - How has the relationship evolved?`;
}

function buildReflectorUserPrompt(input: ReflectorInput): string {
  const {
    pairState,
    recentEvents,
    existingObservations,
    existingOpenThreads,
    existingGraphFacts,
  } = input;

  const eventsText = recentEvents.length > 0
    ? recentEvents
        .map((e) => `- [${e.id.slice(0, 8)}] [${e.eventType}] ${e.summary} (salience: ${e.salience})`)
        .join('\n')
    : 'No recent events';

  const observationsText = existingObservations.length > 0
    ? existingObservations
        .map((o) => `- [${o.id.slice(0, 8)}] ${o.summary} (salience: ${o.salience})`)
        .join('\n')
    : 'No existing observations';

  const threadsText = existingOpenThreads.length > 0
    ? existingOpenThreads
        .map((t) => `- [${t.key}] ${t.summary} (severity: ${t.severity}, status: ${t.status})`)
        .join('\n')
    : 'No open threads';

  const factsText = existingGraphFacts.length > 0
    ? existingGraphFacts
        .slice(0, 20)
        .map((f) => `- [${f.id.slice(0, 8)}] ${f.subject} ${f.predicate} ${JSON.stringify(f.object)} (confidence: ${f.confidence}, status: ${f.status})`)
        .join('\n')
    : 'No graph facts';

  return `## Current Pair State
- Affinity: ${pairState.affinity}/100
- Trust: ${pairState.trust}/100
- Intimacy Readiness: ${pairState.intimacyReadiness}/100
- Conflict: ${pairState.conflict}/100
- Current Phase: ${pairState.activePhaseId}

## Recent Events to Process
${eventsText}

## Existing Observations
${observationsText}

## Open Threads
${threadsText}

## Graph Facts (sample)
${factsText}

---

Analyze the above and provide:
1. New observations to create (summarizing patterns)
2. Thread updates (resolve, escalate, or update)
3. Fact merges (combine duplicates)
4. Quality labels (score items based on usefulness)
5. Overall reflection summary`;
}
