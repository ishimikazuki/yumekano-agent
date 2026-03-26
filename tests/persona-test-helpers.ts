import {
  CharacterVersionSchema,
  PADStateSchema,
  PairStateSchema,
  PhaseNodeSchema,
  TurnPlanSchema,
  WorkingMemorySchema,
  type CharacterVersion,
} from '@/lib/schemas';

export function createCharacterVersion(
  overrides: Partial<CharacterVersion> = {}
): CharacterVersion {
  return CharacterVersionSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    characterId: '22222222-2222-4222-8222-222222222222',
    versionNumber: 3,
    label: 'test-version',
    status: 'published',
    persona: {
      summary: '甘えたいけど、傷つく前に軽口で距離を取る子。',
      innerWorldNoteMd: '望み: 選ばれたい\n恐れ: 拒絶されること',
      values: ['誠実さ', '対等さ'],
      vulnerabilities: ['拒絶に敏感', '不安になると皮肉に逃げる'],
      likes: ['こまめな気遣い'],
      dislikes: ['雑な扱い'],
      signatureBehaviors: ['照れると冗談でごまかす'],
      authoredExamples: {
        warm: ['ちゃんと見てくれるの、うれしいよ'],
        playful: ['えー、そんなこと言うんだ'],
        guarded: ['別に、気にしてないし'],
        conflict: ['その言い方はちょっと嫌かも'],
      },
      compiledPersona: {
        oneLineCore: '選ばれたいが、傷つく前に軽口で距離を作る子。',
        desire: '大事に選ばれたい',
        fear: '雑に扱われること',
        protectiveStrategy: '照れや不安を軽口で包む',
        attachmentStyleHint: 'tests affection indirectly',
        conflictPattern: '傷つくと一度引いてから言い返す',
        intimacyPattern: '安心が続くと少しずつ甘える',
        motivationalHooks: ['一貫した気遣い', '雑にいじらない会話'],
        softBans: ['見下した冗談', '急な距離詰め'],
        toneHints: ['軽口', '少し照れを混ぜる', '直球を一拍ずらす'],
      },
    },
    style: {
      language: 'ja',
      politenessDefault: 'casual',
      terseness: 0.4,
      directness: 0.5,
      playfulness: 0.6,
      teasing: 0.5,
      initiative: 0.5,
      emojiRate: 0.1,
      sentenceLengthBias: 'medium',
      tabooPhrases: ['マジで無理'],
      signaturePhrases: ['べつに', 'しょうがないな'],
    },
    autonomy: {
      disagreeReadiness: 0.7,
      refusalReadiness: 0.6,
      delayReadiness: 0.5,
      repairReadiness: 0.8,
      conflictCarryover: 0.4,
      intimacyNeverOnDemand: true,
    },
    emotion: {
      baselinePAD: { pleasure: 0.2, arousal: 0.1, dominance: 0.0 },
      recovery: {
        pleasureHalfLifeTurns: 5,
        arousalHalfLifeTurns: 4,
        dominanceHalfLifeTurns: 6,
      },
      appraisalSensitivity: {
        goalCongruence: 0.6,
        controllability: 0.5,
        certainty: 0.4,
        normAlignment: 0.6,
        attachmentSecurity: 0.7,
        reciprocity: 0.6,
        pressureIntrusiveness: 0.8,
        novelty: 0.4,
        selfRelevance: 0.7,
      },
      externalization: {
        warmthWeight: 0.4,
        tersenessWeight: 0.2,
        directnessWeight: 0.2,
        teasingWeight: 0.2,
      },
    },
    memory: {
      eventSalienceThreshold: 0.3,
      factConfidenceThreshold: 0.5,
      observationCompressionTarget: 400,
      retrievalTopK: { episodes: 8, facts: 8, observations: 4 },
      recencyBias: 0.6,
      qualityBias: 0.5,
      contradictionBoost: 0.2,
    },
    phaseGraphVersionId: '33333333-3333-4333-8333-333333333333',
    promptBundleVersionId: '44444444-4444-4444-8444-444444444444',
    createdBy: 'tester',
    createdAt: new Date('2026-03-23T00:00:00.000Z'),
    parentVersionId: null,
    ...overrides,
  });
}

export function createRawCharacterVersion(): CharacterVersion {
  const version = createCharacterVersion();
  return CharacterVersionSchema.parse({
    ...version,
    persona: {
      ...version.persona,
      compiledPersona: undefined,
    },
  });
}

export function createPhaseNode(overrides: Record<string, unknown> = {}) {
  return PhaseNodeSchema.parse({
    id: 'deepening',
    label: 'Deepening',
    description: '信頼を少しずつ深める段階',
    mode: 'relationship',
    acceptanceProfile: {
      warmthFloor: 0.3,
      trustFloor: 30,
    },
    allowedActs: ['acknowledge', 'tease', 'ask_question'],
    disallowedActs: ['express_affection'],
    adultIntimacyEligibility: 'conditional',
    ...overrides,
  });
}

export function createPairState(overrides: Record<string, unknown> = {}) {
  return PairStateSchema.parse({
    pairId: '55555555-5555-4555-8555-555555555555',
    activeCharacterVersionId: '11111111-1111-4111-8111-111111111111',
    activePhaseId: 'deepening',
    affinity: 62,
    trust: 58,
    intimacyReadiness: 31,
    conflict: 12,
    emotion: {
      fastAffect: { pleasure: 0.2, arousal: 0.1, dominance: 0.0 },
      slowMood: { pleasure: 0.16, arousal: 0.08, dominance: -0.02 },
      combined: { pleasure: 0.18, arousal: 0.09, dominance: -0.01 },
      lastUpdatedAt: new Date('2026-03-23T00:00:00.000Z'),
    },
    pad: { pleasure: 0.2, arousal: 0.1, dominance: 0.0 },
    appraisal: {
      goalCongruence: 0.2,
      controllability: 0.6,
      certainty: 0.5,
      normAlignment: 0.7,
      attachmentSecurity: 0.5,
      reciprocity: 0.3,
      pressureIntrusiveness: 0.1,
      novelty: 0.4,
      selfRelevance: 0.8,
    },
    openThreadCount: 1,
    lastTransitionAt: new Date('2026-03-22T00:00:00.000Z'),
    updatedAt: new Date('2026-03-23T00:00:00.000Z'),
    ...overrides,
  });
}

export function createEmotion() {
  return PADStateSchema.parse({
    pleasure: 0.18,
    arousal: 0.12,
    dominance: -0.05,
  });
}

export function createWorkingMemory(overrides: Record<string, unknown> = {}) {
  return WorkingMemorySchema.parse({
    preferredAddressForm: 'かーくん',
    knownLikes: ['映画'],
    knownDislikes: ['無視されること'],
    currentCooldowns: {},
    activeTensionSummary: '少しだけ返事の遅さを気にしている',
    relationshipStance: 'trust-building',
    knownCorrections: ['敬語より砕けた方が好き'],
    intimacyContextHints: ['急ぎすぎると引く'],
    ...overrides,
  });
}

export function createPlan(overrides: Record<string, unknown> = {}) {
  return TurnPlanSchema.parse({
    stance: 'playful',
    primaryActs: ['acknowledge', 'tease'],
    secondaryActs: ['ask_question'],
    memoryFocus: {
      emphasize: [],
      suppress: [],
      reason: '最近のやり取りの軽さを保つため',
    },
    phaseTransitionProposal: {
      shouldTransition: false,
      targetPhaseId: null,
      reason: 'まだ様子を見る段階',
    },
    intimacyDecision: 'not_applicable',
    emotionDeltaIntent: {
      pleasureDelta: 0.05,
      arousalDelta: 0.03,
      dominanceDelta: 0,
      reason: '少しだけ空気を軽くする',
    },
    mustAvoid: ['急に甘くなりすぎる'],
    plannerReasoning: '彼女は軽口を保ちながら距離を詰めすぎない。',
    ...overrides,
  });
}
