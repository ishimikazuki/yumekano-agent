import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import { assemblePrompt, formatDesignerFragment, hashPrompt } from '../prompts/assemble';
import {
  TurnPlan,
  CharacterVersion,
  PairState,
  PADState,
  WorkingMemory,
} from '@/lib/schemas';

/**
 * Memory extraction output schema
 */
const WorkingMemoryPatchSchema = z.object({
  preferredAddressForm: z.string().nullable().optional(),
  addLikes: z.array(z.string()).optional(),
  addDislikes: z.array(z.string()).optional(),
  addCorrections: z.array(z.string()).optional(),
  activeTensionSummary: z.string().nullable().optional(),
  relationshipStance: z.string().nullable().optional(),
  addIntimacyHints: z.array(z.string()).optional(),
});

const EpisodicEventSchema = z.object({
  eventType: z.string(),
  summary: z.string(),
  salience: z.number().min(0).max(1),
  retrievalKeys: z.array(z.string()),
  emotionSignature: z.object({
    pleasure: z.number(),
    arousal: z.number(),
    dominance: z.number(),
  }).nullable(),
  participants: z.array(z.string()),
});

const GraphFactSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.unknown(),
  confidence: z.number().min(0).max(1),
  supersedesExisting: z.boolean(),
});

const OpenThreadUpdateSchema = z.object({
  key: z.string(),
  action: z.enum(['open', 'update', 'resolve']),
  summary: z.string().optional(),
  severity: z.number().min(0).max(1).optional(),
});

const MemoryExtractionSchema = z.object({
  workingMemoryPatch: WorkingMemoryPatchSchema,
  episodicEvents: z.array(EpisodicEventSchema),
  graphFacts: z.array(GraphFactSchema),
  openThreadUpdates: z.array(OpenThreadUpdateSchema),
  extractionNotes: z.string(),
});

export type MemoryExtractorInput = {
  characterVersion: CharacterVersion;
  pairStateBefore: PairState;
  workingMemoryBefore: WorkingMemory;
  userMessage: string;
  assistantMessage: string;
  plan: TurnPlan;
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  promptOverride?: string;
};

export type MemoryExtractionResult = z.infer<typeof MemoryExtractionSchema>;

export type MemoryExtractorOutput = {
  extraction: MemoryExtractionResult;
  modelId: string;
  systemPromptHash: string;
};

/**
 * The Memory Extractor converts completed turns into durable memory artifacts.
 */
export async function runMemoryExtractor(
  input: MemoryExtractorInput
): Promise<MemoryExtractorOutput> {
  const registry = getProviderRegistry();
  const model = registry.getModel('structuredPostturnFast');
  const modelInfo = registry.getModelInfo('structuredPostturnFast');

  const systemPrompt = buildExtractorSystemPrompt(input);
  const userPrompt = buildExtractorUserPrompt(input);

  const result = await generateObject({
    model,
    schema: MemoryExtractionSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return {
    extraction: result.object,
    modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
    systemPromptHash: hashPrompt(systemPrompt),
  };
}

export function buildExtractorSystemPrompt(input: MemoryExtractorInput): string {
  const { promptOverride } = input;

  return assemblePrompt([
    '# Memory Extractor System Prompt',
    'You convert a completed turn into durable memory artifacts.',
    formatDesignerFragment(promptOverride),
    `## Principles
1. Save only what can matter later.
2. Separate stable facts from one-off events.
3. Preserve corrections explicitly.
4. Capture emotional significance, not just keywords.
5. Avoid redundant paraphrases.

## What to Extract

### Working Memory Patch
- New preferences learned (address form, likes, dislikes)
- Corrections the user made
- Changes to active tension or relationship stance
- Intimacy context hints

### Episodic Events
Events worth remembering:
- Significant emotional moments
- Promises made or broken
- Conflicts or resolutions
- Milestones in the relationship
- Important revelations

### Graph Facts
Stable relational facts:
- User preferences and traits
- Things the character promised
- Established relationship dynamics
- Known constraints

### Open Thread Updates
Unresolved issues that should affect future turns:
- Arguments not yet resolved
- Questions left unanswered
- Promises pending fulfillment
- Trust repair in progress

## Salience Guidelines
- 0.0-0.3: Routine interaction, no need to remember
- 0.4-0.6: Worth noting, may be referenced later
- 0.7-0.9: Important, should influence future behavior
- 1.0: Critical, must not be forgotten`,
  ]);
}

function buildExtractorUserPrompt(input: MemoryExtractorInput): string {
  const {
    pairStateBefore,
    workingMemoryBefore,
    userMessage,
    assistantMessage,
    plan,
    recentDialogue,
  } = input;

  const recentDialogueText = recentDialogue
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'User' : 'Character'}: ${m.content}`)
    .join('\n');

  return `## State Before This Turn
- Affinity: ${pairStateBefore.affinity}/100
- Trust: ${pairStateBefore.trust}/100
- Conflict: ${pairStateBefore.conflict}/100

## Working Memory Before
- Preferred Address: ${workingMemoryBefore.preferredAddressForm ?? 'Unknown'}
- Known Likes: ${workingMemoryBefore.knownLikes.join(', ') || 'None'}
- Known Dislikes: ${workingMemoryBefore.knownDislikes.join(', ') || 'None'}
- Active Tension: ${workingMemoryBefore.activeTensionSummary ?? 'None'}

## Recent Dialogue Context
${recentDialogueText}

## This Turn
**User said:** ${userMessage}

**Character responded:** ${assistantMessage}

## Plan That Guided This Response
- Stance: ${plan.stance}
- Acts: ${plan.primaryActs.join(', ')}
- Intimacy Decision: ${plan.intimacyDecision}
- Emotion Delta Intent: P=${plan.emotionDeltaIntent.pleasureDelta}, A=${plan.emotionDeltaIntent.arousalDelta}, D=${plan.emotionDeltaIntent.dominanceDelta}

---

Extract what should be remembered from this turn.
Focus on information that will matter for future conversations.
If nothing significant happened, return minimal or empty arrays.`;
}
