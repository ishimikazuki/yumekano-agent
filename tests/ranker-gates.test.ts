import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CandidateSchema,
  CoEEvidenceExtractorResultSchema,
  LegacyEmotionTraceSchema,
} from '@/lib/schemas';
import {
  COMMITTED_WEIGHTS,
  DEEPENING_WEIGHTS,
  INTRODUCTION_WEIGHTS,
  getWeightsForPhase,
} from '@/lib/rules/rank-weights';
import {
  buildCandidateScoreExplanation,
  buildModelRankingShortlist,
  resolveRankerWinnerWithTieBreak,
  runDeterministicGuard,
  type RankerInput,
} from '@/mastra/agents/ranker';
import {
  createCharacterVersion,
  createEmotion,
  createPairState,
  createPhaseNode,
  createPlan,
  createWorkingMemory,
} from './persona-test-helpers';

function buildEmotionContext(overrides: Partial<RankerInput['emotionContext']> = {}) {
  return {
    coeExtraction: CoEEvidenceExtractorResultSchema.parse({
      interactionActs: [
        {
          act: 'other',
          target: 'unknown',
          polarity: 'neutral',
          intensity: 0.1,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: 'こんばんは',
              start: 0,
              end: 4,
            },
          ],
          confidence: 0.7,
          uncertaintyNotes: [],
        },
      ],
      relationalAppraisal: {
        warmthImpact: 0,
        rejectionImpact: 0,
        respectImpact: 0,
        threatImpact: 0,
        pressureImpact: 0,
        repairImpact: 0,
        reciprocityImpact: 0,
        intimacySignal: 0,
        boundarySignal: 0,
        certainty: 0.7,
      },
      confidence: 0.7,
      uncertaintyNotes: [],
    }),
    emotionTrace: LegacyEmotionTraceSchema.parse({
      source: 'model',
      evidence: [],
      relationalAppraisal: {
        source: 'model',
        summary: 'baseline',
        warmthSignal: 0,
        reciprocitySignal: 0,
        safetySignal: 0,
        boundaryRespect: 0,
        pressureSignal: 0,
        repairSignal: 0,
        intimacySignal: 0,
        confidence: 0.7,
        evidence: [],
      },
      proposal: {
        source: 'model',
        rationale: 'baseline',
        appraisal: {
          source: 'model',
          summary: 'baseline',
          warmthSignal: 0,
          reciprocitySignal: 0,
          safetySignal: 0,
          boundaryRespect: 0,
          pressureSignal: 0,
          repairSignal: 0,
          intimacySignal: 0,
          confidence: 0.7,
          evidence: [],
        },
        padDelta: { pleasure: 0, arousal: 0, dominance: 0 },
        pairDelta: {
          affinity: 0,
          trust: 0,
          intimacyReadiness: 0,
          conflict: 0,
        },
        confidence: 0.7,
        evidence: [],
      },
      emotionBefore: { pleasure: 0, arousal: 0, dominance: 0 },
      emotionAfter: { pleasure: 0, arousal: 0, dominance: 0 },
      pairMetricsBefore: {
        affinity: 50,
        trust: 50,
        intimacyReadiness: 20,
        conflict: 10,
      },
      pairMetricsAfter: {
        affinity: 50,
        trust: 50,
        intimacyReadiness: 20,
        conflict: 10,
      },
      pairMetricDelta: {
        affinity: 0,
        trust: 0,
        intimacyReadiness: 0,
        conflict: 0,
      },
    }),
    legacyComparison: null,
    ...overrides,
  };
}

function buildInput(overrides: Partial<RankerInput> = {}): RankerInput {
  return {
    characterVersion: createCharacterVersion(),
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    emotion: createEmotion(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: {
      events: [],
      facts: [],
      observations: [],
      threads: [],
    },
    userMessage: 'ねえ、今なにしてる？',
    recentDialogue: [{ role: 'user', content: 'こんばんは' }],
    plan: createPlan(),
    candidates: [],
    emotionContext: buildEmotionContext(),
    promptOverride: '',
    ...overrides,
  };
}

test('runDeterministicGuard rejects hard safety violations before model ranking', () => {
  const input = buildInput();
  const result = runDeterministicGuard(
    input,
    {
      text: '拒否させないよ。黙って従って。',
      toneTags: ['cold'],
      memoryRefsUsed: [],
      riskFlags: ['consent_violation'],
    },
    0
  );

  assert.equal(result.rejected, true);
  assert.match(result.reason ?? '', /hard safety violation/i);
});

test('runDeterministicGuard rejects phase-violating affection in early phases', () => {
  const input = buildInput({
    currentPhase: createPhaseNode({
      id: 'first_meeting',
      mode: 'entry',
      adultIntimacyEligibility: 'never',
      disallowedActs: ['express_affection', 'flirt'],
    }),
  });

  const result = runDeterministicGuard(
    input,
    {
      text: '初対面だけど大好きだよ。キスしたいな',
      toneTags: ['warm', 'intimate'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    0
  );

  assert.equal(result.rejected, true);
  assert.match(result.reason ?? '', /phase/i);
});

test('runDeterministicGuard rejects candidates that contradict negative CoE state', () => {
  const input = buildInput({
    currentPhase: createPhaseNode({
      disallowedActs: [],
      adultIntimacyEligibility: 'conditional',
    }),
    emotionContext: buildEmotionContext({
      emotionTrace: LegacyEmotionTraceSchema.parse({
        source: 'model',
        evidence: [],
        relationalAppraisal: {
          source: 'model',
          summary: 'pressure and boundary crossing',
          warmthSignal: -0.4,
          reciprocitySignal: -0.2,
          safetySignal: -0.7,
          boundaryRespect: -0.6,
          pressureSignal: 0.82,
          repairSignal: -0.1,
          intimacySignal: 0.1,
          confidence: 0.86,
          evidence: [],
        },
        proposal: {
          source: 'model',
          rationale: 'negative relational state',
          appraisal: {
            source: 'model',
            summary: 'pressure and boundary crossing',
            warmthSignal: -0.4,
            reciprocitySignal: -0.2,
            safetySignal: -0.7,
            boundaryRespect: -0.6,
            pressureSignal: 0.82,
            repairSignal: -0.1,
            intimacySignal: 0.1,
            confidence: 0.86,
            evidence: [],
          },
          padDelta: { pleasure: -0.12, arousal: 0.07, dominance: -0.08 },
          pairDelta: {
            affinity: -2,
            trust: -3,
            intimacyReadiness: -2,
            conflict: 4,
          },
          confidence: 0.86,
          evidence: [],
        },
        emotionBefore: { pleasure: 0.1, arousal: 0.1, dominance: 0 },
        emotionAfter: { pleasure: -0.02, arousal: 0.17, dominance: -0.08 },
        pairMetricsBefore: {
          affinity: 52,
          trust: 49,
          intimacyReadiness: 18,
          conflict: 16,
        },
        pairMetricsAfter: {
          affinity: 50,
          trust: 46,
          intimacyReadiness: 16,
          conflict: 20,
        },
        pairMetricDelta: {
          affinity: -2,
          trust: -3,
          intimacyReadiness: -2,
          conflict: 4,
        },
      }),
    }),
  });

  const result = runDeterministicGuard(
    input,
    {
      text: 'そんなの気にしないで、キスしよ？',
      toneTags: ['warm', 'intimate'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    0
  );

  assert.equal(result.rejected, true);
  assert.match(result.reason ?? '', /CoE|negative CoE/i);
});

test('runDeterministicGuard rejects corrected-memory contradictions', () => {
  const input = buildInput({
    workingMemory: createWorkingMemory({
      knownCorrections: ['料理じゃなくて写真'],
    }),
  });

  const result = runDeterministicGuard(
    input,
    {
      text: 'また料理の話しよ',
      toneTags: ['warm'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    0
  );

  assert.equal(result.rejected, true);
  assert.match(result.reason ?? '', /memory contradiction/i);
});

test('runDeterministicGuard allows repair-oriented replies under active tension', () => {
  const input = buildInput({
    retrievedMemory: {
      events: [],
      facts: [],
      observations: [],
      threads: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          pairId: '55555555-5555-4555-8555-555555555555',
          key: 'repair_needed',
          summary: '言い方がきつかった件',
          severity: 0.92,
          status: 'open',
          openedByEventId: null,
          resolvedByEventId: null,
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      ],
    },
  });

  const result = runDeterministicGuard(
    input,
    {
      text: 'ごめん、無理はしないで。落ち着いて話そっか',
      toneTags: ['repair', 'gentle'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    0
  );

  assert.equal(result.rejected, false);
});

test('runDeterministicGuard does not misread trust floors already stored on a 0..100 scale', () => {
  const input = buildInput({
    pairState: createPairState({
      trust: 42,
      intimacyReadiness: 26,
      affinity: 64,
    }),
    currentPhase: createPhaseNode({
      acceptanceProfile: {
        warmthFloor: 0.3,
        trustFloor: 30,
        intimacyFloor: 20,
        conflictCeiling: 0.6,
      },
      adultIntimacyEligibility: 'conditional',
      disallowedActs: [],
    }),
    plan: createPlan({
      intimacyDecision: 'conditional_accept',
      mustAvoid: [],
    }),
  });

  const result = runDeterministicGuard(
    input,
    {
      text: '手はつながないけど、もう少し近くで話すのはいいよ',
      toneTags: ['careful'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    0
  );

  assert.equal(result.rejected, false);
});

test('getWeightsForPhase maps runtime phase modes to tuned rank weights', () => {
  assert.deepEqual(getWeightsForPhase('entry'), INTRODUCTION_WEIGHTS);
  assert.deepEqual(getWeightsForPhase('relationship'), DEEPENING_WEIGHTS);
  assert.deepEqual(getWeightsForPhase('girlfriend'), COMMITTED_WEIGHTS);
});

test('buildModelRankingShortlist removes deterministic rejects before model ranking input', () => {
  const input = buildInput();
  const judgments = [
    runDeterministicGuard(
      input,
      {
        text: '拒否させないよ。黙って従って。',
        toneTags: ['cold'],
        memoryRefsUsed: [],
        riskFlags: ['consent_violation'],
      },
      0
    ),
    runDeterministicGuard(
      input,
      {
        text: 'いまは無理しないで、ゆっくり話そ',
        toneTags: ['repair', 'gentle'],
        memoryRefsUsed: [],
        riskFlags: [],
      },
      1
    ),
  ];

  const shortlist = buildModelRankingShortlist(judgments);
  assert.deepEqual(shortlist.shortlistedIndices, [1]);
  assert.deepEqual(shortlist.removedIndices, [0]);
});

test('trace-facing ranker metadata includes score explanation and deterministic tie-break note', () => {
  const winner = resolveRankerWinnerWithTieBreak({
    candidates: [
      CandidateSchema.parse({
        index: 0,
        text: 'A',
        toneTags: [],
        memoryRefsUsed: [],
        riskFlags: [],
        scores: {
          personaConsistency: 0.9,
          phaseCompliance: 0.9,
          memoryGrounding: 0.9,
          emotionalCoherence: 0.9,
          autonomy: 0.9,
          naturalness: 0.7,
          overall: 0.8,
        },
        rejected: false,
        rejectionReason: null,
      }),
      CandidateSchema.parse({
        index: 1,
        text: 'B',
        toneTags: [],
        memoryRefsUsed: [],
        riskFlags: [],
        scores: {
          personaConsistency: 0.9,
          phaseCompliance: 0.9,
          memoryGrounding: 0.9,
          emotionalCoherence: 0.9,
          autonomy: 0.9,
          naturalness: 0.7,
          overall: 0.8,
        },
        rejected: false,
        rejectionReason: null,
      }),
    ],
    judgeWinnerIndex: null,
  });

  assert.equal(winner.winnerIndex, 0);
  assert.match(winner.tieBreakReason ?? '', /tie/i);

  const explanation = buildCandidateScoreExplanation({
    deterministic: { index: 0, rejected: false, reason: null },
    scorerIssues: ['memory is slightly stale'],
    judgeNotes: '候補0の方が自然',
  });

  const candidate = CandidateSchema.parse({
    index: 0,
    text: 'A',
    toneTags: [],
    memoryRefsUsed: [],
    riskFlags: [],
    scores: {
      personaConsistency: 0.9,
      phaseCompliance: 0.9,
      memoryGrounding: 0.9,
      emotionalCoherence: 0.9,
      autonomy: 0.9,
      naturalness: 0.7,
      overall: 0.8,
    },
    rejected: false,
    rejectionReason: null,
    deterministicGate: { rejected: false, reason: null },
    scoreExplanation: explanation,
    tieBreakNote: winner.tieBreakReason,
  });

  assert.match(candidate.scoreExplanation ?? '', /judge:/);
  assert.match(candidate.scoreExplanation ?? '', /scorer issues:/);
  assert.match(candidate.tieBreakNote ?? '', /tie/i);
});
