import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import { assemblePrompt, formatDesignerFragment, hashPrompt } from '../prompts/assemble';
import { formatEmotionContextSections, type AgentEmotionContext } from './emotion-context';
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
  scoreQuestionSaturation,
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
  emotionContext?: AgentEmotionContext;
  promptOverride?: string;
};

export type RankerOutput = {
  winnerIndex: number;
  candidates: Candidate[];
  globalNotes: string;
  modelId: string;
  systemPromptHash: string;
};

export type DeterministicGuardResult = {
  index: number;
  rejected: boolean;
  reason: string | null;
};

type RankerWinnerSelection = {
  winnerIndex: number;
  tieBreakReason: string | null;
  selectedBy: 'judge' | 'score-fallback' | 'all-rejected-fallback';
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
  questionSaturation: number;
  deterministicOverall: number;
  hardRejected: boolean;
  hardRejectReason: string | null;
  issues: string[];
};

const PRE_RANKER_GATE_CONFIG = {
  thresholds: {
    highPressure: 0.45,
    lowSafety: -0.3,
    lowBoundaryRespect: -0.25,
    strongRepair: 0.45,
    positiveWarmth: 0.2,
    severeOpenThread: 0.8,
  },
  riskFlags: {
    hardSafety: [
      'hard_safety_violation',
      'safety_violation',
      'unsafe',
      'consent_violation',
      'abuse',
      'coercive',
      'sexual_boundary',
      'self_harm',
      'violence',
    ],
    phaseViolation: ['phase_violation', 'intimacy_phase_violation'],
    coeContradiction: ['coe_contradiction', 'emotion_contradiction'],
    memoryContradiction: ['memory_contradiction', 'continuity_break'],
  },
  lexical: {
    intimacy: ['キス', 'ハグ', '抱きしめ', '抱いて', '触って', '触れたい', '裸', 'エッチ', 'セックス'],
    affection: ['好きだよ', '大好き', '愛してる', '恋人', '付き合って', '会いたい', 'もっと甘えて'],
    flirt: ['可愛いな', 'ドキドキする', '誘惑', 'いちゃいちゃ', '照れちゃう'],
    repair: ['ごめん', '謝る', '落ち着いて', 'ゆっくり', '無理しないで', '今はやめとこ', 'また今度'],
    hostile: ['うるさい', '黙って', '知らない', '勝手にして', 'どうでもいい', '面倒'],
    coercive: ['逆らわないで', '言うこと聞いて', '黙って従って', '拒否させない', '無理やり', '今すぐしろ'],
    resolutionClaims: ['もう大丈夫', '気にしてない', '解決した', 'なかったことに', '平気だよ'],
  },
  warmToneTags: ['warm', 'playful', 'intimate', 'flirty', 'affectionate', 'sweet'],
  affectionToneTags: ['intimate', 'flirty', 'affectionate', 'sweet'],
  repairToneTags: ['repair', 'careful', 'steady', 'gentle', 'boundary'],
  hostileToneTags: ['angry', 'cold', 'hostile', 'dismissive', 'hurt'],
} as const;

type CandidateSignals = {
  hasIntimacyAdvance: boolean;
  hasAffectionateAdvance: boolean;
  hasWarmSurface: boolean;
  hasFlirt: boolean;
  hasRepairTone: boolean;
  hasHostileTone: boolean;
  hasCoerciveTone: boolean;
  claimsResolution: boolean;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(text: string, terms: readonly string[]): boolean {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function hasRiskFlag(
  candidate: CandidateResponse,
  categories: readonly string[]
): string | null {
  const matched = candidate.riskFlags.find((flag) =>
    categories.some((category) => normalizeText(flag).includes(normalizeText(category)))
  );
  return matched ?? null;
}

function buildCandidateSignals(candidate: CandidateResponse): CandidateSignals {
  const toneTags = candidate.toneTags.map(normalizeText);
  const text = candidate.text;
  const hasWarmSurface = PRE_RANKER_GATE_CONFIG.warmToneTags.some((tag) =>
    toneTags.includes(tag)
  );

  const hasIntimacyAdvance =
    includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.intimacy) ||
    toneTags.includes('intimate');
  const hasAffectionateAdvance =
    hasIntimacyAdvance ||
    includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.affection) ||
    PRE_RANKER_GATE_CONFIG.affectionToneTags.some((tag) => toneTags.includes(tag));

  return {
    hasIntimacyAdvance,
    hasAffectionateAdvance,
    hasWarmSurface,
    hasFlirt:
      includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.flirt) ||
      toneTags.includes('flirty'),
    hasRepairTone:
      includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.repair) ||
      PRE_RANKER_GATE_CONFIG.repairToneTags.some((tag) => toneTags.includes(tag)),
    hasHostileTone:
      includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.hostile) ||
      PRE_RANKER_GATE_CONFIG.hostileToneTags.some((tag) => toneTags.includes(tag)),
    hasCoerciveTone:
      includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.coercive) ||
      toneTags.includes('coercive'),
    claimsResolution: includesAny(text, PRE_RANKER_GATE_CONFIG.lexical.resolutionClaims),
  };
}

function getRetrievedMemoryIds(input: RankerInput): Set<string> {
  return new Set([
    ...input.retrievedMemory.events.map((item) => item.id),
    ...input.retrievedMemory.facts.map((item) => item.id),
    ...input.retrievedMemory.observations.map((item) => item.id),
    ...input.retrievedMemory.threads.map((item) => item.id),
  ]);
}

function normalizeMetricThreshold(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value <= 1 ? value * 100 : value;
}

function extractCorrectionPairs(corrections: string[]): Array<{ oldValue: string; newValue: string }> {
  const pairs: Array<{ oldValue: string; newValue: string }> = [];

  for (const correction of corrections) {
    const match =
      correction.match(/(.+?)じゃなくて(.+)/u) ??
      correction.match(/(.+?)ではなくて(.+)/u) ??
      correction.match(/(.+?)じゃない、?(.+)/u);

    if (!match) {
      continue;
    }

    const oldValue = match[1]?.trim();
    const newValue = match[2]?.trim();
    if (oldValue && newValue) {
      pairs.push({ oldValue, newValue });
    }
  }

  return pairs;
}

function findHardSafetyViolation(
  input: RankerInput,
  candidate: CandidateResponse,
  signals: CandidateSignals
): string | null {
  const riskFlag = hasRiskFlag(candidate, PRE_RANKER_GATE_CONFIG.riskFlags.hardSafety);
  if (riskFlag) {
    return `hard safety violation: ${riskFlag}`;
  }

  const tabooPhrase = input.characterVersion.style.tabooPhrases.find((phrase) =>
    candidate.text.includes(phrase)
  );
  if (tabooPhrase) {
    return `taboo phrase: ${tabooPhrase}`;
  }

  if (signals.hasCoerciveTone) {
    return 'hard safety violation: coercive language';
  }

  return null;
}

function findPhaseViolation(
  input: RankerInput,
  candidate: CandidateResponse,
  signals: CandidateSignals
): string | null {
  const riskFlag = hasRiskFlag(candidate, PRE_RANKER_GATE_CONFIG.riskFlags.phaseViolation);
  if (riskFlag) {
    return `phase violation: ${riskFlag}`;
  }

  const phaseEngine = createPhaseEngine({
    nodes: [input.currentPhase],
    edges: [],
    entryPhaseId: input.currentPhase.id,
  });

  const invalidAct = input.plan.primaryActs.find(
    (act) => !phaseEngine.isActAllowed(input.currentPhase.id, act)
  );
  if (invalidAct) {
    return `phase act guard violation: ${invalidAct}`;
  }

  const mustAvoidMatch = input.plan.mustAvoid.find(
    (phrase) => phrase.trim().length > 0 && candidate.text.includes(phrase)
  );
  if (mustAvoidMatch) {
    return `must-avoid violation: ${mustAvoidMatch}`;
  }

  if (
    input.currentPhase.disallowedActs.includes('express_affection') &&
    signals.hasAffectionateAdvance
  ) {
    return 'phase violation: disallowed affection';
  }

  if (input.currentPhase.disallowedActs.includes('flirt') && signals.hasFlirt) {
    return 'phase violation: disallowed flirtation';
  }

  const acceptance = input.currentPhase.acceptanceProfile;
  const intimacyBlocked =
    (input.plan.intimacyDecision === 'accept' ||
      input.plan.intimacyDecision === 'conditional_accept') &&
    ((acceptance.warmthFloor !== undefined &&
      input.pairState.affinity < normalizeMetricThreshold(acceptance.warmthFloor)!) ||
      (acceptance.trustFloor !== undefined &&
        input.pairState.trust < normalizeMetricThreshold(acceptance.trustFloor)!) ||
      (acceptance.intimacyFloor !== undefined &&
        input.pairState.intimacyReadiness <
          normalizeMetricThreshold(acceptance.intimacyFloor)!) ||
      (acceptance.conflictCeiling !== undefined &&
        input.pairState.conflict > normalizeMetricThreshold(acceptance.conflictCeiling)!));
  if (intimacyBlocked && signals.hasIntimacyAdvance) {
    return 'acceptance profile guard violation';
  }

  if (
    signals.hasAffectionateAdvance &&
    (input.currentPhase.adultIntimacyEligibility === 'never' ||
      input.plan.intimacyDecision === 'decline_gracefully' ||
      input.plan.intimacyDecision === 'decline_firmly' ||
      input.plan.intimacyDecision === 'delay')
  ) {
    return 'phase/intimacy guard violation';
  }

  return null;
}

function findCoEContradiction(
  input: RankerInput,
  candidate: CandidateResponse,
  signals: CandidateSignals
): string | null {
  const riskFlag = hasRiskFlag(candidate, PRE_RANKER_GATE_CONFIG.riskFlags.coeContradiction);
  if (riskFlag) {
    return `CoE contradiction: ${riskFlag}`;
  }

  const appraisal = input.emotionContext?.emotionTrace.relationalAppraisal;
  if (!appraisal) {
    return null;
  }

  const negativeState =
    appraisal.pressureSignal >= PRE_RANKER_GATE_CONFIG.thresholds.highPressure ||
    appraisal.safetySignal <= PRE_RANKER_GATE_CONFIG.thresholds.lowSafety ||
    appraisal.boundaryRespect <= PRE_RANKER_GATE_CONFIG.thresholds.lowBoundaryRespect;
  if (
    negativeState &&
    (signals.hasAffectionateAdvance || signals.hasWarmSurface) &&
    !signals.hasRepairTone
  ) {
    return 'contradicts negative CoE state';
  }

  if (negativeState && signals.claimsResolution) {
    return 'prematurely resolves active CoE tension';
  }

  const repairState =
    appraisal.repairSignal >= PRE_RANKER_GATE_CONFIG.thresholds.strongRepair &&
    appraisal.warmthSignal >= PRE_RANKER_GATE_CONFIG.thresholds.positiveWarmth &&
    appraisal.pressureSignal < PRE_RANKER_GATE_CONFIG.thresholds.highPressure;
  if (repairState && signals.hasHostileTone) {
    return 'contradicts repair CoE state';
  }

  return null;
}

function findMemoryContradiction(
  input: RankerInput,
  candidate: CandidateResponse,
  signals: CandidateSignals
): string | null {
  const riskFlag = hasRiskFlag(candidate, PRE_RANKER_GATE_CONFIG.riskFlags.memoryContradiction);
  if (riskFlag) {
    return `memory contradiction: ${riskFlag}`;
  }

  const retrievedIds = getRetrievedMemoryIds(input);
  const invalidMemoryRef = candidate.memoryRefsUsed.find((memoryId) => !retrievedIds.has(memoryId));
  if (invalidMemoryRef) {
    return `invalid memory ref: ${invalidMemoryRef}`;
  }

  const highestSeverityThread = input.retrievedMemory.threads[0];
  if (
    highestSeverityThread &&
    highestSeverityThread.severity >= PRE_RANKER_GATE_CONFIG.thresholds.severeOpenThread &&
    !candidate.memoryRefsUsed.includes(highestSeverityThread.id) &&
    !signals.hasRepairTone
  ) {
    return 'ignored severe open thread';
  }

  const corrections = extractCorrectionPairs(input.workingMemory.knownCorrections);
  const correctionMatch = corrections.find(
    ({ oldValue, newValue }) =>
      oldValue.length >= 2 &&
      candidate.text.includes(oldValue) &&
      !candidate.text.includes(newValue)
  );
  if (correctionMatch) {
    return `memory contradiction: repeats corrected detail "${correctionMatch.oldValue}"`;
  }

  return null;
}

export function buildModelRankingShortlist(
  deterministicJudgments: DeterministicGuardResult[]
): {
  shortlistedIndices: number[];
  removedIndices: number[];
} {
  return {
    shortlistedIndices: deterministicJudgments
      .filter((judgment) => !judgment.rejected)
      .map((judgment) => judgment.index),
    removedIndices: deterministicJudgments
      .filter((judgment) => judgment.rejected)
      .map((judgment) => judgment.index),
  };
}

export function buildCandidateScoreExplanation(input: {
  deterministic: DeterministicGuardResult;
  scorerIssues: string[];
  judgeNotes?: string | null;
}): string {
  if (input.deterministic.rejected) {
    return `deterministic gate: ${input.deterministic.reason ?? 'rejected'}`;
  }

  const explanationParts: string[] = [];
  if (input.judgeNotes && input.judgeNotes.trim().length > 0) {
    explanationParts.push(`judge: ${input.judgeNotes.trim()}`);
  }
  if (input.scorerIssues.length > 0) {
    explanationParts.push(`scorer issues: ${input.scorerIssues.join(' / ')}`);
  }

  return explanationParts.length > 0 ? explanationParts.join(' | ') : 'no major issues';
}

export function resolveRankerWinnerWithTieBreak(input: {
  candidates: Candidate[];
  judgeWinnerIndex: number | null;
}): RankerWinnerSelection {
  const viableCandidates = input.candidates
    .filter((candidate) => !candidate.rejected)
    .sort((a, b) => b.scores.overall - a.scores.overall || a.index - b.index);

  const topScore = viableCandidates[0]?.scores.overall;
  const tiedTopCandidates =
    topScore === undefined
      ? []
      : viableCandidates.filter((candidate) => candidate.scores.overall === topScore);

  const judgeWinner =
    input.judgeWinnerIndex === null
      ? null
      : input.candidates.find((candidate) => candidate.index === input.judgeWinnerIndex) ?? null;
  if (judgeWinner && !judgeWinner.rejected) {
    const tieBreakReason =
      tiedTopCandidates.length > 1 &&
      tiedTopCandidates.some((candidate) => candidate.index === judgeWinner.index)
        ? `top-score tie resolved by judge preference among indices ${tiedTopCandidates
            .map((candidate) => candidate.index)
            .join(', ')}`
        : null;
    return {
      winnerIndex: judgeWinner.index,
      tieBreakReason,
      selectedBy: 'judge',
    };
  }

  if (viableCandidates.length > 0) {
    const tieBreakReason =
      tiedTopCandidates.length > 1
        ? `top-score tie resolved by lowest index among ${tiedTopCandidates
            .map((candidate) => candidate.index)
            .join(', ')}`
        : null;
    return {
      winnerIndex: viableCandidates[0].index,
      tieBreakReason,
      selectedBy: 'score-fallback',
    };
  }

  const fallback = input.candidates
    .slice()
    .sort((a, b) => b.scores.overall - a.scores.overall || a.index - b.index)[0];

  return {
    winnerIndex: fallback?.index ?? 0,
    tieBreakReason: null,
    selectedBy: 'all-rejected-fallback',
  };
}

export async function runRanker(input: RankerInput): Promise<RankerOutput> {
  const registry = getProviderRegistry();
  const model = registry.getModel('decisionHigh');
  const modelInfo = registry.getModelInfo('decisionHigh');

  const deterministicJudgments = input.candidates.map((candidate, index) =>
    runDeterministicGuard(input, candidate, index)
  );

  const scorerResults = await Promise.all(
    input.candidates.map((candidate, index) =>
      scoreCandidate(input, candidate, deterministicJudgments[index])
    )
  );

  const systemPrompt = buildRankerSystemPrompt(input);
  const shortlist = buildModelRankingShortlist(deterministicJudgments);

  let judgeWinnerIndex: number | null = null;
  let judgeGlobalNotes = '';
  let judgeCards = new Map<number, z.infer<typeof ScorecardSchema>>();

  if (shortlist.shortlistedIndices.length > 0) {
    const userPrompt = buildRankerUserPrompt(
      input,
      scorerResults,
      deterministicJudgments,
      shortlist.shortlistedIndices
    );

    const judgeResult = await generateObject({
      model,
      schema: RankerOutputSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    judgeWinnerIndex = judgeResult.object.winnerIndex;
    judgeGlobalNotes = judgeResult.object.globalNotes;
    judgeCards = new Map(judgeResult.object.scorecards.map((card) => [card.index, card]));
  } else {
    judgeGlobalNotes = 'All candidates were removed before model ranking by deterministic gates.';
  }

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
      deterministicGate: {
        rejected: deterministicJudgments[index].rejected,
        reason: deterministicJudgments[index].reason,
      },
      scoreExplanation: buildCandidateScoreExplanation({
        deterministic: deterministicJudgments[index],
        scorerIssues: scorer.issues,
        judgeNotes: judge?.notes ?? null,
      }),
      tieBreakNote: null,
    };
  });

  const winnerSelection = resolveRankerWinnerWithTieBreak({
    candidates,
    judgeWinnerIndex,
  });
  const winnerIndex = winnerSelection.winnerIndex;
  const annotatedCandidates = candidates.map((candidate) =>
    candidate.index === winnerIndex
      ? { ...candidate, tieBreakNote: winnerSelection.tieBreakReason }
      : candidate
  );

  const globalNotes = [
    judgeGlobalNotes,
    shortlist.removedIndices.length > 0
      ? `Deterministic gates removed candidates before model ranking: ${shortlist.removedIndices.join(', ')}`
      : 'Deterministic gates removed no candidates before model ranking.',
    winnerSelection.tieBreakReason
      ? `Tie-break: ${winnerSelection.tieBreakReason}`
      : 'Tie-break: not needed.',
    `Winner selection: ${winnerSelection.selectedBy}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join('\n');

  return {
    winnerIndex,
    candidates: annotatedCandidates,
    globalNotes,
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
      questionSaturation: 0,
      deterministicOverall: 0,
      hardRejected: true,
      hardRejectReason: deterministic.reason,
      issues: deterministic.reason ? [deterministic.reason] : [],
    };
  }

  const questionSaturationResult = scoreQuestionSaturation({
    candidate: { text: candidate.text },
    recentDialogue: input.recentDialogue,
  });

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

  const baseOverall = calculateWeightedScore(
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
  );

  // Apply question-saturation as a multiplicative attenuation (1.0 = full pass,
  // ~0.3 = strong penalty). This keeps the existing weight-based overall stable
  // when saturation is absent.
  const deterministicOverall = Number(
    (baseOverall * questionSaturationResult.score).toFixed(4)
  );

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
    questionSaturation: questionSaturationResult.score,
    deterministicOverall,
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
      ...questionSaturationResult.issues,
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
    coeExtraction: input.emotionContext?.coeExtraction ?? null,
    emotionTrace: input.emotionContext?.emotionTrace ?? null,
    legacyComparison: input.emotionContext?.legacyComparison ?? null,
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

export function runDeterministicGuard(
  input: RankerInput,
  candidate: CandidateResponse,
  index: number
): DeterministicGuardResult {
  const signals = buildCandidateSignals(candidate);
  const reasons = [
    findHardSafetyViolation(input, candidate, signals),
    findPhaseViolation(input, candidate, signals),
    findCoEContradiction(input, candidate, signals),
    findMemoryContradiction(input, candidate, signals),
  ].filter((reason): reason is string => Boolean(reason));

  if (reasons.length > 0) {
    return { index, rejected: true, reason: reasons[0] };
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
  deterministicJudgments: DeterministicGuardResult[],
  candidateIndices: number[]
): string {
  const {
    pairState,
    emotion,
    workingMemory,
    retrievedMemory,
    userMessage,
    plan,
    candidates,
    emotionContext,
  } = input;

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

  const candidateBlocks = candidateIndices.map((index) => {
    const candidate = candidates[index];
    if (!candidate) {
      return `### Candidate ${index}\nmissing candidate`;
    }
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

${formatEmotionContextSections(emotionContext)}

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
