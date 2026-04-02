import { generateObject } from 'ai';
import { z } from 'zod';
import { assemblePrompt, formatDesignerFragment, hashPrompt } from '../prompts/assemble';
import { getProviderRegistry, type ProviderRegistry } from '../providers/registry';
import type {
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  PairState,
  PhaseNode,
  WorkingMemory,
  CoEEvidenceExtractorResult,
  ExtractedInteractionAct,
  EvidenceSpan,
  RelationalAppraisal,
} from '@/lib/schemas';
import {
  CoEEvidenceExtractorResultSchema,
  ExtractedInteractionActSchema,
  EvidenceSpanSchema,
  RelationalAppraisalSchema,
} from '@/lib/schemas';

const LooseObjectSchema = z.object({}).passthrough();
const RawExtractorOutputSchema = z.object({
  interactionActs: z.array(z.unknown()),
  relationalAppraisal: z.unknown().optional(),
  confidence: z.number().optional(),
  uncertaintyNotes: z.array(z.string()).optional(),
});
const RawInteractionActSchema = z.object({
  act: z.unknown(),
  target: z.unknown(),
  polarity: z.unknown(),
  intensity: z.unknown(),
  evidenceSpans: z.array(z.unknown()),
  confidence: z.unknown().optional(),
  uncertaintyNotes: z.array(z.string()).optional(),
});

type CoEGenerateObject = (input: {
  model: unknown;
  schema: z.ZodTypeAny;
  system: string;
  prompt: string;
}) => Promise<{ object: unknown }>;

type ProviderRegistryLike = Pick<ProviderRegistry, 'getModel' | 'getModelInfo'>;

export type CoEEvidenceExtractorInput = {
  userMessage: string;
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentPhase: PhaseNode;
  pairState: PairState;
  workingMemory: WorkingMemory;
  retrievedMemory: {
    facts: MemoryFact[];
    events: MemoryEvent[];
    observations: MemoryObservation[];
    threads: OpenThread[];
  };
  openThreads: OpenThread[];
  promptOverride?: string;
};

export type CoEEvidenceExtractorOutput = {
  extraction: CoEEvidenceExtractorResult;
  modelId: string;
  systemPromptHash: string;
  attempts: number;
};

export type CoEEvidenceExtractorDeps = {
  generateObjectImpl?: CoEGenerateObject;
  registry?: ProviderRegistryLike;
  maxAttempts?: number;
};

const DEFAULT_MAX_ATTEMPTS = 2;

function parseLooseObject(raw: unknown, label: string): Record<string, unknown> {
  return LooseObjectSchema.parse(raw, {
    path: [label],
  });
}

function averageConfidence(acts: ExtractedInteractionAct[]): number {
  if (acts.length === 0) {
    return 0.5;
  }

  return Number(
    (acts.reduce((sum, act) => sum + act.confidence, 0) / acts.length).toFixed(4)
  );
}

function buildSafeFallbackRelationalAppraisal(): RelationalAppraisal {
  return {
    warmthImpact: 0,
    rejectionImpact: 0,
    respectImpact: 0,
    threatImpact: 0,
    pressureImpact: 0,
    repairImpact: 0,
    reciprocityImpact: 0,
    intimacySignal: 0,
    boundarySignal: 0,
    certainty: 0,
  };
}

function parseRelationalAppraisalWithRepair(
  raw: unknown
): { value: RelationalAppraisal; repairNote: string | null } {
  if (raw === undefined) {
    return {
      value: buildSafeFallbackRelationalAppraisal(),
      repairNote:
        'relationalAppraisal was missing; neutral fallback appraisal was applied.',
    };
  }

  try {
    return {
      value: RelationalAppraisalSchema.parse(raw),
      repairNote: null,
    };
  } catch (error) {
    return {
      value: buildSafeFallbackRelationalAppraisal(),
      repairNote: `relationalAppraisal was invalid; neutral fallback appraisal was applied: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function buildSafeFallbackExtraction(
  input: CoEEvidenceExtractorInput,
  lastError: unknown
): CoEEvidenceExtractorResult {
  const fallbackText = input.userMessage.trim() || 'No user message provided.';
  const note = `Safe fallback used after malformed extractor output: ${
    lastError instanceof Error ? lastError.message : String(lastError)
  }`;

  return CoEEvidenceExtractorResultSchema.parse({
    interactionActs: [
      {
        act: 'other',
        target: 'unknown',
        polarity: 'neutral',
        intensity: 0,
        evidenceSpans: [
          {
            source: 'user_message',
            sourceId: null,
            text: fallbackText,
            start: 0,
            end: Math.max(0, fallbackText.length - 1),
          },
        ],
        confidence: 0.1,
        uncertaintyNotes: [note],
      },
    ],
    relationalAppraisal: buildSafeFallbackRelationalAppraisal(),
    confidence: 0.1,
    uncertaintyNotes: [note],
  });
}

export function parseEvidenceSpanModelOutput(raw: unknown): EvidenceSpan {
  const candidate = parseLooseObject(raw, 'evidence_span');

  return EvidenceSpanSchema.parse({
    source: candidate.source,
    sourceId: candidate.sourceId ?? null,
    text: candidate.text,
    start: candidate.start,
    end: candidate.end,
  });
}

export function parseExtractedInteractionActModelOutput(
  raw: unknown
): ExtractedInteractionAct {
  const candidate = RawInteractionActSchema.parse(
    parseLooseObject(raw, 'interaction_act')
  );

  return ExtractedInteractionActSchema.parse({
    act: candidate.act,
    target: candidate.target,
    polarity: candidate.polarity,
    intensity: candidate.intensity,
    evidenceSpans: z
      .array(z.unknown())
      .parse(candidate.evidenceSpans)
      .map(parseEvidenceSpanModelOutput),
    confidence: candidate.confidence ?? 0.5,
    uncertaintyNotes: candidate.uncertaintyNotes ?? [],
  });
}

export function parseCoEEvidenceExtractorOutput(
  raw: unknown
): CoEEvidenceExtractorResult {
  const candidate = RawExtractorOutputSchema.parse(raw);
  const interactionActs = candidate.interactionActs.map(
    parseExtractedInteractionActModelOutput
  );
  const relational = parseRelationalAppraisalWithRepair(
    candidate.relationalAppraisal
  );
  const uncertaintyNotes = candidate.uncertaintyNotes ?? [];
  if (relational.repairNote) {
    uncertaintyNotes.push(relational.repairNote);
  }

  return CoEEvidenceExtractorResultSchema.parse({
    interactionActs,
    relationalAppraisal: relational.value,
    confidence: candidate.confidence ?? averageConfidence(interactionActs),
    uncertaintyNotes,
  });
}

function formatRecentDialogue(
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  if (recentDialogue.length === 0) {
    return 'None';
  }

  return recentDialogue
    .slice(-8)
    .map(
      (turn, index) =>
        `- [${index}] ${turn.role === 'user' ? 'User' : 'Character'}: ${turn.content}`
    )
    .join('\n');
}

function formatFacts(facts: MemoryFact[]): string {
  if (facts.length === 0) {
    return 'None';
  }

  return facts
    .slice(0, 8)
    .map(
      (fact) =>
        `- [${fact.id}] ${fact.subject} ${fact.predicate} ${JSON.stringify(fact.object)}`
    )
    .join('\n');
}

function formatEvents(events: MemoryEvent[]): string {
  if (events.length === 0) {
    return 'None';
  }

  return events
    .slice(0, 6)
    .map((event) => `- [${event.id}] ${event.eventType}: ${event.summary}`)
    .join('\n');
}

function formatObservations(observations: MemoryObservation[]): string {
  if (observations.length === 0) {
    return 'None';
  }

  return observations
    .slice(0, 6)
    .map((observation) => `- [${observation.id}] ${observation.summary}`)
    .join('\n');
}

function formatThreads(threads: OpenThread[]): string {
  if (threads.length === 0) {
    return 'None';
  }

  return threads
    .slice(0, 6)
    .map(
      (thread) =>
        `- [${thread.id}] key=${thread.key} severity=${thread.severity}: ${thread.summary}`
    )
    .join('\n');
}

export function buildCoEEvidenceExtractorSystemPrompt(
  input: CoEEvidenceExtractorInput
): string {
  const { promptOverride } = input;

  return assemblePrompt([
    '# CoE Evidence Extractor System Prompt',
    'You are a structured semantic analyzer for relationship turns.',
    'Your job is to extract evidence about what the user is doing in the interaction, not to roleplay or answer the user.',
    formatDesignerFragment(promptOverride),
    `## Extraction Rules
1. Identify the user interaction acts that matter emotionally or relationally.
2. For each act, return a target, polarity, intensity, evidence spans, and confidence.
3. Evidence spans must point to concrete text snippets from the provided context.
4. Use \`uncertaintyNotes\` when the signal is ambiguous, sarcastic, mixed, or underspecified.
5. When there are multiple simultaneous acts, return multiple entries.
6. If no specialized act fits, use \`other\`.

## Act Definitions
- compliment: praise or admiration
- gratitude: explicit thanks or appreciation
- support: reassurance, backing, encouragement
- question: asking for information or clarification
- rejection: soft or hard decline
- insult: contempt, belittling, hostility
- apology: explicit regret or ownership of harm
- repair: explicit attempt to restore the relationship
- pressure: urgency, demands, insistence
- intimacy_bid: request to increase closeness or affection
- boundary_test: pushing past a limit or trying to override consent
- boundary_respect: explicit respect for pacing or limits
- topic_shift: redirecting away from tension or current subject
- disengagement: withdrawal, avoidance, shutting down
- affection: explicit liking, caring, or attachment
- other: meaningful act not covered above

## Output Rules
- Return JSON only.
- Every interaction act must include at least one evidence span.
- \`intensity\` and \`confidence\` are 0..1.
- \`target\` must describe what the act is directed at: character, relationship, boundary, topic, self, memory, phase, or unknown.
- \`polarity\` must be positive, negative, mixed, or neutral.`,
  ]);
}

export function buildCoEEvidenceExtractorUserPrompt(
  input: CoEEvidenceExtractorInput,
  retryReason?: string
): string {
  const prompt = `## User Message
${input.userMessage}

## Recent Dialogue
${formatRecentDialogue(input.recentDialogue)}

## Current Phase
- ID: ${input.currentPhase.id}
- Label: ${input.currentPhase.label}
- Description: ${input.currentPhase.description}
- Mode: ${input.currentPhase.mode}
- Intimacy Eligibility: ${input.currentPhase.adultIntimacyEligibility ?? 'never'}

## Pair State
- Affinity: ${input.pairState.affinity}/100
- Trust: ${input.pairState.trust}/100
- Intimacy Readiness: ${input.pairState.intimacyReadiness}/100
- Conflict: ${input.pairState.conflict}/100
- Open Thread Count: ${input.pairState.openThreadCount}

## Working Memory
- Preferred Address: ${input.workingMemory.preferredAddressForm ?? 'Unknown'}
- Known Likes: ${input.workingMemory.knownLikes.join(', ') || 'None'}
- Known Dislikes: ${input.workingMemory.knownDislikes.join(', ') || 'None'}
- Active Tension: ${input.workingMemory.activeTensionSummary ?? 'None'}
- Relationship Stance: ${input.workingMemory.relationshipStance ?? 'Unknown'}
- Known Corrections: ${input.workingMemory.knownCorrections.join('; ') || 'None'}
- Intimacy Hints: ${input.workingMemory.intimacyContextHints.join('; ') || 'None'}

## Retrieved Facts
${formatFacts(input.retrievedMemory.facts)}

## Retrieved Events
${formatEvents(input.retrievedMemory.events)}

## Retrieved Observations
${formatObservations(input.retrievedMemory.observations)}

## Retrieved Threads
${formatThreads(input.retrievedMemory.threads)}

## Open Threads
${formatThreads(input.openThreads)}

Return the structured semantic evidence extraction now.`;

  if (!retryReason) {
    return prompt;
  }

  return `${prompt}

## Retry Guidance
The previous output was invalid: ${retryReason}
Return schema-valid JSON with every required field present.`;
}

export async function runCoEEvidenceExtractor(
  input: CoEEvidenceExtractorInput,
  deps: CoEEvidenceExtractorDeps = {}
): Promise<CoEEvidenceExtractorOutput> {
  const registry = deps.registry ?? getProviderRegistry();
  const generateObjectImpl = deps.generateObjectImpl ?? (generateObject as CoEGenerateObject);
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const model = registry.getModel('analysisMedium');
  const modelInfo = registry.getModelInfo('analysisMedium');
  const systemPrompt = buildCoEEvidenceExtractorSystemPrompt(input);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await generateObjectImpl({
        model,
        schema: RawExtractorOutputSchema,
        system: systemPrompt,
        prompt: buildCoEEvidenceExtractorUserPrompt(
          input,
          attempt === 1 ? undefined : String(lastError instanceof Error ? lastError.message : lastError)
        ),
      });

      return {
        extraction: parseCoEEvidenceExtractorOutput(result.object),
        modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
        systemPromptHash: hashPrompt(systemPrompt),
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    extraction: buildSafeFallbackExtraction(input, lastError),
    modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
    systemPromptHash: hashPrompt(systemPrompt),
    attempts: maxAttempts,
  };
}
