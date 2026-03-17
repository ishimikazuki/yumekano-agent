import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import {
  TurnPlan,
  CharacterVersion,
  PairState,
  PADState,
  WorkingMemory,
  PhaseNode,
  OpenThread,
  Candidate,
} from '@/lib/schemas';
import type { CandidateResponse } from './generator';

/**
 * Scorecard for a single candidate
 */
const ScorecardSchema = z.object({
  index: z.number(),
  personaConsistency: z.number().min(0).max(1),
  phaseCompliance: z.number().min(0).max(1),
  memoryGrounding: z.number().min(0).max(1),
  emotionalCoherence: z.number().min(0).max(1),
  autonomy: z.number().min(0).max(1),
  naturalness: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
  rejected: z.boolean(),
  rejectionReason: z.string().nullable(),
  notes: z.string(),
});

const RankerOutputSchema = z.object({
  winnerIndex: z.number(),
  scorecards: z.array(ScorecardSchema),
  globalNotes: z.string(),
});

export type RankerInput = {
  characterVersion: CharacterVersion;
  currentPhase: PhaseNode;
  pairState: PairState;
  emotion: PADState;
  workingMemory: WorkingMemory;
  openThreads: OpenThread[];
  userMessage: string;
  plan: TurnPlan;
  candidates: CandidateResponse[];
  promptOverride?: string;
};

export type RankerOutput = {
  winnerIndex: number;
  candidates: Candidate[];
  globalNotes: string;
  modelId: string;
};

/**
 * The Ranker agent scores and selects the best candidate response.
 */
export async function runRanker(input: RankerInput): Promise<RankerOutput> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');
  const modelInfo = registry.getModelInfo('analysisMedium');

  const systemPrompt = buildRankerSystemPrompt(input);
  const userPrompt = buildRankerUserPrompt(input);

  const result = await generateObject({
    model,
    schema: RankerOutputSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  // Convert to Candidate format
  const candidates: Candidate[] = input.candidates.map((c, i) => {
    const scorecard = result.object.scorecards.find((s) => s.index === i);
    return {
      index: i,
      text: c.text,
      scores: {
        personaConsistency: scorecard?.personaConsistency ?? 0,
        phaseCompliance: scorecard?.phaseCompliance ?? 0,
        memoryGrounding: scorecard?.memoryGrounding ?? 0,
        emotionalCoherence: scorecard?.emotionalCoherence ?? 0,
        autonomy: scorecard?.autonomy ?? 0,
        naturalness: scorecard?.naturalness ?? 0,
        overall: scorecard?.overall ?? 0,
      },
      rejected: scorecard?.rejected ?? false,
      rejectionReason: scorecard?.rejectionReason ?? null,
    };
  });

  return {
    winnerIndex: result.object.winnerIndex,
    candidates,
    globalNotes: result.object.globalNotes,
    modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
  };
}

function buildRankerSystemPrompt(input: RankerInput): string {
  const { characterVersion, currentPhase, promptOverride } = input;

  if (promptOverride) {
    return promptOverride;
  }

  return `# Ranker System Prompt

You judge candidate replies for a stateful character conversation system.

## Character: ${characterVersion.persona.summary}

### Current Phase: ${currentPhase.label}
- Allowed acts: ${currentPhase.allowedActs.join(', ')}
- Disallowed acts: ${currentPhase.disallowedActs.join(', ')}
- Intimacy eligibility: ${currentPhase.adultIntimacyEligibility ?? 'never'}

## Perspective
Judge from an outside observer perspective:

> Which reply sounds most like what this character would really say now?

Do NOT reward flattery or blind compliance.

## Score Dimensions (0-1)
- **personaConsistency**: Does this sound like the character?
- **phaseCompliance**: Does it respect phase boundaries?
- **memoryGrounding**: Does it appropriately use/reference known facts?
- **emotionalCoherence**: Does the tone match the emotional state?
- **autonomy**: Does the character maintain independence (not sycophantic)?
- **naturalness**: Does it sound like natural Japanese conversation?

## Hard Rejects
Reject candidates that:
- Violate the phase (e.g., intimacy in 'never' phase)
- Contradict active memory or open threads
- Ignore 'decline' or 'delay' from the plan
- Become generically approving/sycophantic
- Use taboo phrases

Score rejected candidates with overall: 0`;
}

function buildRankerUserPrompt(input: RankerInput): string {
  const {
    pairState,
    emotion,
    workingMemory,
    openThreads,
    userMessage,
    plan,
    candidates,
  } = input;

  const openThreadsText =
    openThreads.length > 0
      ? openThreads
          .map((t) => `- [${t.key}] ${t.summary}`)
          .join('\n')
      : 'None';

  const candidatesText = candidates
    .map((c, i) => `### Candidate ${i}\n${c.text}\nTone: ${c.toneTags.join(', ')}`)
    .join('\n\n');

  return `## Current State
- Affinity: ${pairState.affinity}/100
- Trust: ${pairState.trust}/100
- Conflict: ${pairState.conflict}/100

## Emotion (PAD)
- Pleasure: ${emotion.pleasure.toFixed(2)}
- Arousal: ${emotion.arousal.toFixed(2)}
- Dominance: ${emotion.dominance.toFixed(2)}

## Working Memory
- Active Tension: ${workingMemory.activeTensionSummary ?? 'None'}
- Known Corrections: ${workingMemory.knownCorrections.join('; ') || 'None'}

## Open Threads
${openThreadsText}

## User's Message
${userMessage}

## Plan to Follow
- Stance: ${plan.stance}
- Primary Acts: ${plan.primaryActs.join(', ')}
- Intimacy Decision: ${plan.intimacyDecision}
- Must Avoid: ${plan.mustAvoid.join(', ') || 'None'}

## Candidates to Judge
${candidatesText}

---

Score each candidate and select the best one.
If all candidates are rejected, pick the least bad one but note the issues.`;
}
