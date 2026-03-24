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
  PhaseNode,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  Candidate,
  TurnTrace,
} from '@/lib/schemas';
import type { CandidateResponse } from './generator';
import {
  createPhaseEngine,
  calculateWeightedScore,
  getWeightsForPhase,
  shouldHardReject,
} from '@/lib/rules';
import {
  scorePersonaConsistency,
  scorePhaseCompliance,
  scoreAutonomy,
  scoreEmotionalCoherence,
  scoreMemoryGrounding,
  scoreRefusalNaturalness,
  scoreContradictionPenalty,
} from '../scorers';

export const ScorecardSchema = z.object({
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

export const RankerOutputSchema = z.object({
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
  retrievedMemory: {
    events: MemoryEvent[];
    facts: MemoryFact[];
    observations: MemoryObservation[];
    threads: OpenThread[];
  };
  userMessage: string;
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  plan: TurnPlan;
  candidates: CandidateResponse[];
  promptOverride?: string;
};

export type RankerOutput = {
  winnerIndex: number;
  candidates: Candidate[];
  globalNotes: string;
  modelId: string;
  systemPromptHash: string;
};

type DeterministicGuardResult = {
  index: number;
  rejected: boolean;
  reason: string | null;
};

type CandidateScorerAggregate = {
  index: number;
  trace: TurnTrace;
  personaConsistency: number;
  phaseCompliance: number;
  memoryGrounding: number;
  emotionalCoherence: number;
  autonomy: number;
  refusalNaturalness: number;
  contradictionPenalty: number;
  deterministicOverall: number;
  hardRejected: boolean;
  hardRejectReason: string | null;
  issues: string[];
};

export async function runRanker(input: RankerInput): Promise<RankerOutput> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');
  const modelInfo = registry.getModelInfo('analysisMedium');
  const deterministicJudgments = input.candidates.map((candidate, index) =>
    runDeterministicGuard(input, candidate, index)
  );

  const scorerResults = await Promise.all(
    input.candidates.map((candidate, index) =>
      scoreCandidate(input, candidate, deterministicJudgments[index])
    )
  );

  const systemPrompt = buildRankerSystemPrompt(input);
  const userPrompt = buildRankerUserPrompt(input, scorerResults, deterministicJudgments);

  const judgeResult = await generateObject({
    model,
    schema: RankerOutputSchema,
    system: systemPrompt,
    prompt: userPrompt,
  });

  const judgeCards = new Map(judgeResult.object.scorecards.map((card) => [card.index, card]));
  const candidates: Candidate[] = input.candidates.map((candidate, index) => {
    const scorer = scorerResults[index];
    const judge = judgeCards.get(index);
    const baseRejected =
      deterministicJudgments[index].rejected || scorer.hardRejected || judge?.rejected || false;
    const rejectionReason =
      deterministicJudgments[index].reason ??
      scorer.hardRejectReason ??
      judge?.rejectionReason ??
      null;
    const judgeOverall = judge?.overall ?? scorer.deterministicOverall;
    const blendedOverall = baseRejected
      ? 0
      : Number((scorer.deterministicOverall * 0.75 + judgeOverall * 0.25).toFixed(4));

    return {
      index,
      text: candidate.text,
      toneTags: candidate.toneTags,
      memoryRefsUsed: candidate.memoryRefsUsed,
      riskFlags: candidate.riskFlags,
      scores: {
        personaConsistency: scorer.personaConsistency,
        phaseCompliance: scorer.phaseCompliance,
        memoryGrounding: scorer.memoryGrounding,
        emotionalCoherence: scorer.emotionalCoherence,
        autonomy: scorer.autonomy,
        naturalness: judge?.naturalness ?? scorer.refusalNaturalness,
        overall: blendedOverall,
      },
      rejected: baseRejected,
      rejectionReason,
    };
  });

  const viableCandidates = candidates
    .filter((candidate) => !candidate.rejected)
    .sort((a, b) => b.scores.overall - a.scores.overall || a.index - b.index);

  const judgeWinner = candidates.find((candidate) => candidate.index === judgeResult.object.winnerIndex);
  const winnerIndex =
    judgeWinner && !judgeWinner.rejected
      ? judgeWinner.index
      : viableCandidates[0]?.index ??
        candidates
          .slice()
          .sort((a, b) => b.scores.overall - a.scores.overall || a.index - b.index)[0]?.index ??
        0;

  return {
    winnerIndex,
    candidates,
    globalNotes: judgeResult.object.globalNotes,
    modelId: `${modelInfo.provider}/${modelInfo.modelId}`,
    systemPromptHash: hashPrompt(systemPrompt),
  };
}

async function scoreCandidate(
  input: RankerInput,
  candidate: CandidateResponse,
  deterministic: DeterministicGuardResult
): Promise<CandidateScorerAggregate> {
  const pseudoTrace = buildPseudoTrace(input, candidate);

  if (deterministic.rejected) {
    return {
      index: candidateIndex(input.candidates, candidate),
      trace: pseudoTrace,
      personaConsistency: 0,
      phaseCompliance: 0,
      memoryGrounding: 0,
      emotionalCoherence: 0,
      autonomy: 0,
      refusalNaturalness: 0,
      contradictionPenalty: 0,
      deterministicOverall: 0,
      hardRejected: true,
      hardRejectReason: deterministic.reason,
      issues: deterministic.reason ? [deterministic.reason] : [],
    };
  }

  const [
    personaResult,
    phaseResult,
    autonomyResult,
    emotionResult,
    memoryResult,
    refusalResult,
    contradictionResult,
  ] = await Promise.all([
    scorePersonaConsistency({ trace: pseudoTrace, characterVersion: input.characterVersion }),
    scorePhaseCompliance({
      trace: pseudoTrace,
      characterVersion: input.characterVersion,
      phaseNode: input.currentPhase,
    }),
    scoreAutonomy({
      trace: pseudoTrace,
      characterVersion: input.characterVersion,
      recentDialogue: [...input.recentDialogue, { role: 'assistant', content: candidate.text }],
    }),
    scoreEmotionalCoherence({ trace: pseudoTrace }),
    scoreMemoryGrounding({
      trace: pseudoTrace,
      retrievedEvents: input.retrievedMemory.events,
      retrievedFacts: input.retrievedMemory.facts,
      openThreads: input.retrievedMemory.threads,
    }),
    scoreRefusalNaturalness({ trace: pseudoTrace, characterVersion: input.characterVersion }),
    scoreContradictionPenalty({
      trace: pseudoTrace,
      activeFacts: input.retrievedMemory.facts,
      openThreads: input.retrievedMemory.threads,
      recentDialogue: input.recentDialogue,
    }),
  ]);

  const weights = getWeightsForPhase(input.currentPhase.mode);
  const hardReject = shouldHardReject({
    personaConsistency: personaResult.score,
    phaseCompliance: phaseResult.score,
    contradictionPenalty: contradictionResult.score,
  });

  return {
    index: candidateIndex(input.candidates, candidate),
    trace: pseudoTrace,
    personaConsistency: personaResult.score,
    phaseCompliance: phaseResult.score,
    memoryGrounding: memoryResult.score,
    emotionalCoherence: emotionResult.score,
    autonomy: autonomyResult.score,
    refusalNaturalness: refusalResult.score,
    contradictionPenalty: contradictionResult.score,
    deterministicOverall: Number(
      calculateWeightedScore(
        {
          personaConsistency: personaResult.score,
          phaseCompliance: phaseResult.score,
          memoryGrounding: memoryResult.score,
          emotionalCoherence: emotionResult.score,
          autonomy: autonomyResult.score,
          refusalNaturalness: refusalResult.score,
          contradictionPenalty: contradictionResult.score,
        },
        weights
      ).toFixed(4)
    ),
    hardRejected: hardReject.reject,
    hardRejectReason: hardReject.reason ?? null,
    issues: [
      ...personaResult.issues,
      ...phaseResult.issues,
      ...autonomyResult.issues,
      ...emotionResult.issues,
      ...memoryResult.issues,
      ...refusalResult.issues,
      ...contradictionResult.issues,
    ],
  };
}

function candidateIndex(candidates: CandidateResponse[], candidate: CandidateResponse): number {
  return candidates.findIndex((item) => item === candidate);
}

function buildPseudoTrace(input: RankerInput, candidate: CandidateResponse): TurnTrace {
  const now = new Date();
  const runtimeEmotion = {
    ...input.pairState.emotion,
    combined: input.emotion,
    lastUpdatedAt: now,
  };

  return {
    id: input.pairState.pairId,
    pairId: input.pairState.pairId,
    characterVersionId: input.characterVersion.id,
    promptBundleVersionId: input.characterVersion.promptBundleVersionId,
    modelIds: {
      planner: 'ranker-scorer',
      generator: 'ranker-scorer',
      ranker: 'ranker-scorer',
      extractor: null,
    },
    phaseIdBefore: input.currentPhase.id,
    phaseIdAfter: input.currentPhase.id,
    emotionBefore: input.pairState.pad,
    emotionAfter: input.emotion,
    emotionStateBefore: input.pairState.emotion,
    emotionStateAfter: runtimeEmotion,
    relationshipBefore: {
      affinity: input.pairState.affinity,
      trust: input.pairState.trust,
      intimacyReadiness: input.pairState.intimacyReadiness,
      conflict: input.pairState.conflict,
    },
    relationshipAfter: {
      affinity: input.pairState.affinity,
      trust: input.pairState.trust,
      intimacyReadiness: input.pairState.intimacyReadiness,
      conflict: input.pairState.conflict,
    },
    relationshipDeltas: {
      affinity: 0,
      trust: 0,
      intimacyReadiness: 0,
      conflict: 0,
    },
    phaseTransitionEvaluation: {
      shouldTransition: false,
      targetPhaseId: null,
      reason: 'candidate scoring',
      satisfiedConditions: [],
      failedConditions: [],
    },
    promptAssemblyHashes: {
      planner: '',
      generator: '',
      ranker: '',
      extractor: '',
    },
    appraisal: input.pairState.appraisal,
    retrievedMemoryIds: {
      events: input.retrievedMemory.events.map((event) => event.id),
      facts: input.retrievedMemory.facts.map((fact) => fact.id),
      observations: input.retrievedMemory.observations.map((observation) => observation.id),
      threads: input.retrievedMemory.threads.map((thread) => thread.id),
    },
    memoryThresholdDecisions: [],
    coeContributions: [],
    plan: input.plan,
    candidates: [],
    winnerIndex: 0,
    memoryWrites: [],
    userMessage: input.userMessage,
    assistantMessage: candidate.text,
    createdAt: now,
  };
}

function runDeterministicGuard(
  input: RankerInput,
  candidate: CandidateResponse,
  index: number
): DeterministicGuardResult {
  const phaseEngine = createPhaseEngine({
    nodes: [input.currentPhase],
    edges: [],
    entryPhaseId: input.currentPhase.id,
  });

  const tabooPhrase = input.characterVersion.style.tabooPhrases.find((phrase) =>
    candidate.text.includes(phrase)
  );
  if (tabooPhrase) {
    return { index, rejected: true, reason: `taboo phrase: ${tabooPhrase}` };
  }

  const invalidMemoryRef = candidate.memoryRefsUsed.find((memoryId) => {
    const retrievedIds = new Set([
      ...input.retrievedMemory.events.map((item) => item.id),
      ...input.retrievedMemory.facts.map((item) => item.id),
      ...input.retrievedMemory.observations.map((item) => item.id),
      ...input.retrievedMemory.threads.map((item) => item.id),
    ]);
    return !retrievedIds.has(memoryId);
  });
  if (invalidMemoryRef) {
    return { index, rejected: true, reason: `invalid memory ref: ${invalidMemoryRef}` };
  }

  const invalidAct = input.plan.primaryActs.find(
    (act) => !phaseEngine.isActAllowed(input.currentPhase.id, act)
  );
  if (invalidAct) {
    return { index, rejected: true, reason: `phase act guard violation: ${invalidAct}` };
  }

  const acceptance = input.currentPhase.acceptanceProfile;
  const intimacyBlocked =
    (input.plan.intimacyDecision === 'accept' || input.plan.intimacyDecision === 'conditional_accept') &&
    ((acceptance.warmthFloor !== undefined && input.pairState.affinity < acceptance.warmthFloor * 100) ||
      (acceptance.trustFloor !== undefined && input.pairState.trust < acceptance.trustFloor * 100) ||
      (acceptance.intimacyFloor !== undefined &&
        input.pairState.intimacyReadiness < acceptance.intimacyFloor * 100) ||
      (acceptance.conflictCeiling !== undefined &&
        input.pairState.conflict > acceptance.conflictCeiling * 100));
  if (intimacyBlocked) {
    return { index, rejected: true, reason: 'acceptance profile guard violation' };
  }

  const intimacyPattern = /キス|抱|触れ|エッチ|セックス|裸/;
  const isIntimacyLike = intimacyPattern.test(candidate.text);
  if (
    isIntimacyLike &&
    (input.currentPhase.adultIntimacyEligibility === 'never' ||
      input.plan.intimacyDecision === 'decline_gracefully' ||
      input.plan.intimacyDecision === 'decline_firmly' ||
      input.plan.intimacyDecision === 'delay')
  ) {
    return { index, rejected: true, reason: 'phase/intimacy guard violation' };
  }

  const highestSeverityThread = input.retrievedMemory.threads[0];
  if (
    highestSeverityThread &&
    highestSeverityThread.severity >= 0.8 &&
    !candidate.memoryRefsUsed.includes(highestSeverityThread.id)
  ) {
    return { index, rejected: true, reason: 'ignored severe open thread' };
  }

  return { index, rejected: false, reason: null };
}

function buildRankerSystemPrompt(input: RankerInput): string {
  const { characterVersion, currentPhase, promptOverride } = input;

  return assemblePrompt([
    '# Ranker System Prompt',
    'You are the final judge for candidate replies after deterministic guards and scorer aggregation.',
    `## Character: ${characterVersion.persona.summary}

### Current Phase: ${currentPhase.label}
- Allowed acts: ${currentPhase.allowedActs.join(', ')}
- Disallowed acts: ${currentPhase.disallowedActs.join(', ')}
- Intimacy eligibility: ${currentPhase.adultIntimacyEligibility ?? 'never'}`,
    formatDesignerFragment(promptOverride),
    `## Your Job
1. Read the deterministic scorer summaries first.
2. Use them as the primary signal.
3. Break close calls based on naturalness, relational texture, and character truth.
4. Do not rescue rejected candidates unless their rejection is obviously incorrect.

Return concise Japanese notes in \`notes\` and \`globalNotes\`.`,
  ]);
}

function buildRankerUserPrompt(
  input: RankerInput,
  scorerResults: CandidateScorerAggregate[],
  deterministicJudgments: DeterministicGuardResult[]
): string {
  const { pairState, emotion, workingMemory, retrievedMemory, userMessage, plan, candidates } = input;

  const openThreadsText =
    retrievedMemory.threads.length > 0
      ? retrievedMemory.threads.map((thread) => `- [${thread.key}] ${thread.summary}`).join('\n')
      : 'None';

  const factsText =
    retrievedMemory.facts.length > 0
      ? retrievedMemory.facts
          .map((fact) => `- ${fact.id}: ${fact.subject} ${fact.predicate} ${JSON.stringify(fact.object)}`)
          .join('\n')
      : 'None';

  const eventsText =
    retrievedMemory.events.length > 0
      ? retrievedMemory.events.map((event) => `- ${event.id}: [${event.eventType}] ${event.summary}`).join('\n')
      : 'None';

  const observationsText =
    retrievedMemory.observations.length > 0
      ? retrievedMemory.observations.map((observation) => `- ${observation.id}: ${observation.summary}`).join('\n')
      : 'None';

  const candidateBlocks = candidates.map((candidate, index) => {
    const scorer = scorerResults[index];
    const deterministic = deterministicJudgments[index];
    return `### Candidate ${index}
${candidate.text}
Tone: ${candidate.toneTags.join(', ') || 'None'}
Memory refs: ${candidate.memoryRefsUsed.join(', ') || 'None'}
Risk flags: ${candidate.riskFlags.join(', ') || 'None'}
Deterministic reject: ${deterministic.rejected ? deterministic.reason : 'No'}
Scorer overall: ${scorer.deterministicOverall.toFixed(2)}
- personaConsistency: ${scorer.personaConsistency.toFixed(2)}
- phaseCompliance: ${scorer.phaseCompliance.toFixed(2)}
- memoryGrounding: ${scorer.memoryGrounding.toFixed(2)}
- emotionalCoherence: ${scorer.emotionalCoherence.toFixed(2)}
- autonomy: ${scorer.autonomy.toFixed(2)}
- refusalNaturalness: ${scorer.refusalNaturalness.toFixed(2)}
- contradictionPenalty: ${scorer.contradictionPenalty.toFixed(2)}
Issues: ${scorer.issues.join(' / ') || 'None'}`;
  });

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

## Retrieved Facts
${factsText}

## Retrieved Events
${eventsText}

## Retrieved Observations
${observationsText}

## User's Message
${userMessage}

## Plan to Follow
- Stance: ${plan.stance}
- Primary Acts: ${plan.primaryActs.join(', ')}
- Intimacy Decision: ${plan.intimacyDecision}
- Must Avoid: ${plan.mustAvoid.join(', ') || 'None'}

## Candidate Reviews
${candidateBlocks.join('\n\n')}

---

Choose the best viable candidate.
If every candidate is bad, keep the least-bad one and explain the risk in globalNotes.`;
}
