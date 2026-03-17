import { generateObject } from 'ai';
import { getProviderRegistry } from '../providers/registry';
import {
  TurnPlan,
  TurnPlanSchema,
  CharacterVersion,
  PairState,
  PADState,
  WorkingMemory,
  PhaseNode,
  MemoryEvent,
  MemoryFact,
  OpenThread,
} from '@/lib/schemas';

export type PlannerInput = {
  characterVersion: CharacterVersion;
  currentPhase: PhaseNode;
  pairState: PairState;
  emotion: PADState;
  workingMemory: WorkingMemory;
  retrievedMemory: {
    events: MemoryEvent[];
    facts: MemoryFact[];
    threads: OpenThread[];
  };
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  promptOverride?: string;
};

export type PlannerOutput = {
  plan: TurnPlan;
  modelId: string;
};

/**
 * The Planner agent decides what the character should do next.
 * It thinks in third person about what this character would actually do.
 */
export async function runPlanner(input: PlannerInput): Promise<PlannerOutput> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');
  const modelInfo = registry.getModelInfo('analysisMedium');

  const systemPrompt = buildPlannerSystemPrompt(input);
  const userPrompt = buildPlannerUserPrompt(input);

  const result = await generateObject({
    model,
    schema: TurnPlanSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return {
    plan: result.object,
    modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
  };
}

function buildPlannerSystemPrompt(input: PlannerInput): string {
  const { characterVersion, currentPhase, promptOverride } = input;

  if (promptOverride) {
    return promptOverride;
  }

  return `# Planner System Prompt

You are the planner for a stateful character conversation agent.
Your job is to decide what this character would **actually do next**.

## Character: ${characterVersion.persona.summary}

### Values
${characterVersion.persona.values.map((v) => `- ${v}`).join('\n')}

### Flaws
${characterVersion.persona.flaws.map((f) => `- ${f}`).join('\n')}

### Current Phase: ${currentPhase.label}
${currentPhase.description}

#### Allowed Acts
${currentPhase.allowedActs.map((a) => `- ${a}`).join('\n')}

#### Disallowed Acts
${currentPhase.disallowedActs.map((a) => `- ${a}`).join('\n')}

#### Intimacy Eligibility: ${currentPhase.adultIntimacyEligibility ?? 'never'}

## Autonomy Settings
- Disagree Readiness: ${characterVersion.autonomy.disagreeReadiness}
- Refusal Readiness: ${characterVersion.autonomy.refusalReadiness}
- Delay Readiness: ${characterVersion.autonomy.delayReadiness}
- Repair Readiness: ${characterVersion.autonomy.repairReadiness}
- Conflict Carryover: ${characterVersion.autonomy.conflictCarryover}
- Intimacy Never On Demand: ${characterVersion.autonomy.intimacyNeverOnDemand}

## Rules
1. Think in **third person**, not as a people-pleasing assistant.
2. Prioritize character truth over user satisfaction.
3. Respect the active phase and authored character config.
4. If intimacy is requested, choose based on state, context, and authored personality.
5. Keep girlfriend-mode autonomous.
6. Use memory only when it should genuinely affect behavior.
7. Avoid generic affirmation.`;
}

function buildPlannerUserPrompt(input: PlannerInput): string {
  const {
    pairState,
    emotion,
    workingMemory,
    retrievedMemory,
    recentDialogue,
    userMessage,
  } = input;

  const recentDialogueText = recentDialogue
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Character'}: ${m.content}`)
    .join('\n');

  const openThreadsText =
    retrievedMemory.threads.length > 0
      ? retrievedMemory.threads
          .map((t) => `- [${t.key}] ${t.summary} (severity: ${t.severity})`)
          .join('\n')
      : 'None';

  const factsText =
    retrievedMemory.facts.length > 0
      ? retrievedMemory.facts
          .map((f) => `- ${f.subject} ${f.predicate} ${JSON.stringify(f.object)}`)
          .join('\n')
      : 'None';

  const eventsText =
    retrievedMemory.events.length > 0
      ? retrievedMemory.events
          .map((e) => `- [${e.eventType}] ${e.summary}`)
          .join('\n')
      : 'None';

  return `## Current State
- Affinity: ${pairState.affinity}/100
- Trust: ${pairState.trust}/100
- Intimacy Readiness: ${pairState.intimacyReadiness}/100
- Conflict: ${pairState.conflict}/100

## Emotion (PAD)
- Pleasure: ${emotion.pleasure.toFixed(2)}
- Arousal: ${emotion.arousal.toFixed(2)}
- Dominance: ${emotion.dominance.toFixed(2)}

## Working Memory
- Preferred Address: ${workingMemory.preferredAddressForm ?? 'Unknown'}
- Known Likes: ${workingMemory.knownLikes.join(', ') || 'None'}
- Known Dislikes: ${workingMemory.knownDislikes.join(', ') || 'None'}
- Active Tension: ${workingMemory.activeTensionSummary ?? 'None'}
- Relationship Stance: ${workingMemory.relationshipStance ?? 'Unknown'}
- Known Corrections: ${workingMemory.knownCorrections.join('; ') || 'None'}

## Open Threads (Unresolved Issues)
${openThreadsText}

## Relevant Facts
${factsText}

## Recent Events
${eventsText}

## Recent Dialogue
${recentDialogueText}

## User's Current Message
${userMessage}

---

Based on all of this context, what would this character actually do next?
Think in third person: "She would..." not "I should..."
Consider whether to agree, disagree, delay, redirect, repair, or refuse.`;
}
