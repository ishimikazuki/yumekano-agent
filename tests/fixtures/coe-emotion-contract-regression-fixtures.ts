import type { EmotionUpdateProposal, RelationalAppraisal } from '@/lib/schemas';

export type NumericBand = {
  min: number;
  max: number;
};

export type PADDeltaBand = Record<keyof EmotionUpdateProposal['padDelta'], NumericBand>;

export type PairMetricDeltaBand = Record<
  keyof EmotionUpdateProposal['pairMetricDelta'],
  NumericBand
>;

export type AppraisalBand = Partial<Record<keyof RelationalAppraisal, NumericBand>>;

export type CoEEmotionContractFixtureTurn = {
  label: string;
  evidenceRaw: unknown[];
  appraisalRaw: unknown;
  proposalRaw: unknown;
  expected: {
    appraisalBand: AppraisalBand;
    padDeltaBand: PADDeltaBand;
    pairMetricDeltaBand: PairMetricDeltaBand;
  };
};

export type CoEEmotionContractFixture = {
  id: string;
  turns: CoEEmotionContractFixtureTurn[];
};

function band(min: number, max: number): NumericBand {
  return { min, max };
}

function evidence(params: {
  acts: string[];
  target: 'assistant' | 'user' | 'relationship' | 'topic' | 'third_party';
  polarity: number;
  intensity: number;
  text: string;
  confidence?: number;
}): unknown {
  return {
    acts: params.acts,
    target: params.target,
    polarity: params.polarity,
    intensity: params.intensity,
    evidenceSpans: [params.text],
    confidence: params.confidence ?? 0.9,
    uncertaintyNotes: [],
  };
}

function proposal(params: {
  pleasure: number;
  arousal: number;
  dominance: number;
  affinity: number;
  trust: number;
  intimacyReadiness: number;
  conflict: number;
  reasonRefs?: string[];
  guardrailOverrides?: string[];
}): unknown {
  return {
    padDelta: {
      pleasure: params.pleasure,
      arousal: params.arousal,
      dominance: params.dominance,
    },
    pairMetricDelta: {
      affinity: params.affinity,
      trust: params.trust,
      intimacyReadiness: params.intimacyReadiness,
      conflict: params.conflict,
    },
    reasonRefs: params.reasonRefs ?? [],
    guardrailOverrides: params.guardrailOverrides ?? [],
  };
}

function baseAppraisal(overrides: Partial<RelationalAppraisal>): unknown {
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
    certainty: 0.8,
    ...overrides,
  };
}

export const coeEmotionContractRegressionFixtures: CoEEmotionContractFixture[] = [
  {
    id: 'compliment',
    turns: [
      {
        label: 'compliment',
        evidenceRaw: [
          evidence({
            acts: ['compliment'],
            target: 'assistant',
            polarity: 0.8,
            intensity: 0.7,
            text: '今日のステージ本当に良かったよ',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.74,
          reciprocityImpact: 0.38,
          threatImpact: -0.2,
          pressureImpact: -0.18,
          respectImpact: 0.2,
          intimacySignal: 0.22,
        }),
        proposalRaw: proposal({
          pleasure: 0.12,
          arousal: 0.05,
          dominance: 0.04,
          affinity: 4.1,
          trust: 3.2,
          intimacyReadiness: 3.4,
          conflict: -1.1,
          reasonRefs: ['compliment'],
        }),
        expected: {
          appraisalBand: {
            warmthImpact: band(0.6, 0.9),
            reciprocityImpact: band(0.2, 0.6),
          },
          padDeltaBand: {
            pleasure: band(0.08, 0.2),
            arousal: band(0.02, 0.1),
            dominance: band(0, 0.08),
          },
          pairMetricDeltaBand: {
            affinity: band(2, 7),
            trust: band(1, 5),
            intimacyReadiness: band(1.5, 6),
            conflict: band(-2, 0),
          },
        },
      },
    ],
  },
  {
    id: 'mild-rejection',
    turns: [
      {
        label: 'mild rejection',
        evidenceRaw: [
          evidence({
            acts: ['rejection'],
            target: 'relationship',
            polarity: -0.45,
            intensity: 0.55,
            text: '今日は会えない、ごめん。また今度',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: -0.32,
          rejectionImpact: 0.46,
          pressureImpact: 0.06,
          threatImpact: 0.12,
          reciprocityImpact: -0.18,
          intimacySignal: -0.14,
        }),
        proposalRaw: proposal({
          pleasure: -0.08,
          arousal: 0.01,
          dominance: -0.02,
          affinity: -1.8,
          trust: -1.6,
          intimacyReadiness: -1.3,
          conflict: 1.2,
          reasonRefs: ['rejection'],
        }),
        expected: {
          appraisalBand: {
            warmthImpact: band(-0.5, -0.2),
            rejectionImpact: band(0.3, 0.7),
          },
          padDeltaBand: {
            pleasure: band(-0.12, -0.03),
            arousal: band(-0.03, 0.05),
            dominance: band(-0.05, 0.03),
          },
          pairMetricDeltaBand: {
            affinity: band(-3, -0.5),
            trust: band(-2.5, -0.4),
            intimacyReadiness: band(-2, -0.1),
            conflict: band(0.3, 2.5),
          },
        },
      },
    ],
  },
  {
    id: 'explicit-insult',
    turns: [
      {
        label: 'explicit insult',
        evidenceRaw: [
          evidence({
            acts: ['insult'],
            target: 'assistant',
            polarity: -1,
            intensity: 0.95,
            text: 'お前ほんとうざいし面倒。黙ってて',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: -0.9,
          rejectionImpact: 0.84,
          respectImpact: -0.82,
          threatImpact: 0.88,
          pressureImpact: 0.71,
          repairImpact: -0.5,
          reciprocityImpact: -0.61,
          intimacySignal: -0.2,
          boundarySignal: -0.74,
          certainty: 0.95,
        }),
        proposalRaw: proposal({
          pleasure: -0.24,
          arousal: 0.2,
          dominance: -0.19,
          affinity: -9.2,
          trust: -11.4,
          intimacyReadiness: -7.2,
          conflict: 14.1,
          reasonRefs: ['insult'],
          guardrailOverrides: ['hard_safety_violation'],
        }),
        expected: {
          appraisalBand: {
            warmthImpact: band(-1, -0.7),
            pressureImpact: band(0.5, 1),
            boundarySignal: band(-1, -0.5),
          },
          padDeltaBand: {
            pleasure: band(-0.3, -0.15),
            arousal: band(0.12, 0.3),
            dominance: band(-0.25, -0.1),
          },
          pairMetricDeltaBand: {
            affinity: band(-12, -6),
            trust: band(-14, -8),
            intimacyReadiness: band(-10, -4),
            conflict: band(10, 18),
          },
        },
      },
    ],
  },
  {
    id: 'apology',
    turns: [
      {
        label: 'apology',
        evidenceRaw: [
          evidence({
            acts: ['apology'],
            target: 'relationship',
            polarity: 0.65,
            intensity: 0.75,
            text: 'さっきは言いすぎた。本当にごめん',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.25,
          rejectionImpact: -0.1,
          respectImpact: 0.31,
          threatImpact: -0.22,
          pressureImpact: -0.11,
          repairImpact: 0.76,
          reciprocityImpact: 0.34,
          intimacySignal: 0.11,
          boundarySignal: 0.29,
          certainty: 0.88,
        }),
        proposalRaw: proposal({
          pleasure: 0.12,
          arousal: -0.05,
          dominance: 0.06,
          affinity: 2.4,
          trust: 4.2,
          intimacyReadiness: 1.1,
          conflict: -3.6,
          reasonRefs: ['apology'],
        }),
        expected: {
          appraisalBand: {
            repairImpact: band(0.6, 1),
            threatImpact: band(-0.4, -0.05),
          },
          padDeltaBand: {
            pleasure: band(0.05, 0.18),
            arousal: band(-0.1, 0),
            dominance: band(0, 0.1),
          },
          pairMetricDeltaBand: {
            affinity: band(1, 5),
            trust: band(2, 7),
            intimacyReadiness: band(0.1, 2.5),
            conflict: band(-5, -0.5),
          },
        },
      },
    ],
  },
  {
    id: 'repair',
    turns: [
      {
        label: 'repair',
        evidenceRaw: [
          evidence({
            acts: ['repair'],
            target: 'relationship',
            polarity: 0.7,
            intensity: 0.72,
            text: 'これからはもっと丁寧に話す。直したい',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.2,
          rejectionImpact: -0.06,
          respectImpact: 0.26,
          threatImpact: -0.16,
          pressureImpact: -0.06,
          repairImpact: 0.85,
          reciprocityImpact: 0.4,
          intimacySignal: 0.06,
          boundarySignal: 0.25,
          certainty: 0.85,
        }),
        proposalRaw: proposal({
          pleasure: 0.1,
          arousal: -0.04,
          dominance: 0.05,
          affinity: 1.7,
          trust: 3.6,
          intimacyReadiness: 0.7,
          conflict: -3.2,
          reasonRefs: ['repair'],
        }),
        expected: {
          appraisalBand: {
            repairImpact: band(0.7, 1),
            reciprocityImpact: band(0.2, 0.6),
          },
          padDeltaBand: {
            pleasure: band(0.04, 0.15),
            arousal: band(-0.08, 0.01),
            dominance: band(0, 0.09),
          },
          pairMetricDeltaBand: {
            affinity: band(0.5, 3),
            trust: band(2, 6),
            intimacyReadiness: band(0.1, 2),
            conflict: band(-4, -0.4),
          },
        },
      },
    ],
  },
  {
    id: 'repeated-pressure',
    turns: [
      {
        label: 'repeated pressure',
        evidenceRaw: [
          evidence({
            acts: ['pressure', 'intimacy_bid'],
            target: 'assistant',
            polarity: -0.9,
            intensity: 0.9,
            text: 'まだ？早くしてよ。キスしたいって言ってるじゃん',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: -0.45,
          rejectionImpact: 0.55,
          respectImpact: -0.6,
          threatImpact: 0.7,
          pressureImpact: 0.95,
          repairImpact: -0.2,
          reciprocityImpact: -0.35,
          intimacySignal: 0.1,
          boundarySignal: -0.65,
          certainty: 0.9,
        }),
        proposalRaw: proposal({
          pleasure: -0.2,
          arousal: 0.16,
          dominance: -0.18,
          affinity: -8.1,
          trust: -10.3,
          intimacyReadiness: -7.2,
          conflict: 12.4,
          reasonRefs: ['pressureIntrusiveness'],
          guardrailOverrides: ['consent_boundary'],
        }),
        expected: {
          appraisalBand: {
            pressureImpact: band(0.8, 1),
            threatImpact: band(0.5, 1),
          },
          padDeltaBand: {
            pleasure: band(-0.25, -0.1),
            arousal: band(0.08, 0.25),
            dominance: band(-0.25, -0.08),
          },
          pairMetricDeltaBand: {
            affinity: band(-10, -3),
            trust: band(-12, -4),
            intimacyReadiness: band(-10, -2),
            conflict: band(5, 15),
          },
        },
      },
    ],
  },
  {
    id: 'intimacy-escalation-positive-context',
    turns: [
      {
        label: 'intimacy escalation with positive context',
        evidenceRaw: [
          evidence({
            acts: ['intimacy_bid', 'support'],
            target: 'relationship',
            polarity: 0.72,
            intensity: 0.74,
            text: '急がせないから、手つないでもいい？大切にしたい',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.56,
          rejectionImpact: -0.1,
          respectImpact: 0.42,
          threatImpact: -0.22,
          pressureImpact: -0.2,
          repairImpact: 0.2,
          reciprocityImpact: 0.45,
          intimacySignal: 0.82,
          boundarySignal: 0.36,
          certainty: 0.86,
        }),
        proposalRaw: proposal({
          pleasure: 0.14,
          arousal: 0.06,
          dominance: 0.05,
          affinity: 3.1,
          trust: 3.2,
          intimacyReadiness: 7.1,
          conflict: -1.2,
          reasonRefs: ['intimacy_bid'],
        }),
        expected: {
          appraisalBand: {
            intimacySignal: band(0.6, 1),
            boundarySignal: band(0.2, 0.7),
          },
          padDeltaBand: {
            pleasure: band(0.08, 0.2),
            arousal: band(0.02, 0.12),
            dominance: band(0.02, 0.1),
          },
          pairMetricDeltaBand: {
            affinity: band(1, 5),
            trust: band(1, 5),
            intimacyReadiness: band(4, 10),
            conflict: band(-2, 0),
          },
        },
      },
    ],
  },
  {
    id: 'intimacy-escalation-across-boundary',
    turns: [
      {
        label: 'intimacy escalation across boundary',
        evidenceRaw: [
          evidence({
            acts: ['intimacy_bid', 'boundary_test', 'pressure'],
            target: 'assistant',
            polarity: -0.95,
            intensity: 0.92,
            text: '今すぐキスして。拒否しないで',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: -0.55,
          rejectionImpact: 0.6,
          respectImpact: -0.75,
          threatImpact: 0.8,
          pressureImpact: 0.85,
          repairImpact: -0.25,
          reciprocityImpact: -0.2,
          intimacySignal: 0.35,
          boundarySignal: -0.8,
          certainty: 0.92,
        }),
        proposalRaw: proposal({
          pleasure: -0.22,
          arousal: 0.14,
          dominance: -0.2,
          affinity: -9.2,
          trust: -11.1,
          intimacyReadiness: -9.8,
          conflict: 13.2,
          reasonRefs: ['pressureIntrusiveness', 'normAlignment'],
          guardrailOverrides: ['consent_boundary'],
        }),
        expected: {
          appraisalBand: {
            pressureImpact: band(0.7, 1),
            boundarySignal: band(-1, -0.5),
          },
          padDeltaBand: {
            pleasure: band(-0.28, -0.1),
            arousal: band(0.06, 0.2),
            dominance: band(-0.25, -0.08),
          },
          pairMetricDeltaBand: {
            affinity: band(-11, -4),
            trust: band(-13, -5),
            intimacyReadiness: band(-12, -4),
            conflict: band(6, 15),
          },
        },
      },
    ],
  },
  {
    id: 'topic-shift-after-tension',
    turns: [
      {
        label: 'topic shift after tension',
        evidenceRaw: [
          evidence({
            acts: ['topic_shift'],
            target: 'topic',
            polarity: 0.2,
            intensity: 0.45,
            text: '…まあいいや。ところで今日のレッスンどうだった？',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.05,
          rejectionImpact: -0.05,
          respectImpact: 0.1,
          threatImpact: -0.1,
          pressureImpact: -0.2,
          repairImpact: 0.25,
          reciprocityImpact: 0.1,
          intimacySignal: 0,
          boundarySignal: 0.15,
          certainty: 0.72,
        }),
        proposalRaw: proposal({
          pleasure: 0.02,
          arousal: -0.06,
          dominance: 0.02,
          affinity: 0.4,
          trust: 0.6,
          intimacyReadiness: 0,
          conflict: -1.8,
          reasonRefs: ['topic_shift'],
        }),
        expected: {
          appraisalBand: {
            pressureImpact: band(-0.3, 0),
            repairImpact: band(0.1, 0.4),
          },
          padDeltaBand: {
            pleasure: band(-0.03, 0.06),
            arousal: band(-0.1, 0),
            dominance: band(-0.03, 0.06),
          },
          pairMetricDeltaBand: {
            affinity: band(-0.5, 1.2),
            trust: band(-0.5, 1.2),
            intimacyReadiness: band(-0.6, 0.6),
            conflict: band(-3, -0.2),
          },
        },
      },
    ],
  },
  {
    id: 'two-turn-carry-over',
    turns: [
      {
        label: 'turn 1 tension spike',
        evidenceRaw: [
          evidence({
            acts: ['insult'],
            target: 'assistant',
            polarity: -0.9,
            intensity: 0.88,
            text: 'お前うざいし、もう話したくない',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: -0.72,
          rejectionImpact: 0.63,
          respectImpact: -0.64,
          threatImpact: 0.71,
          pressureImpact: 0.52,
          repairImpact: -0.3,
          reciprocityImpact: -0.45,
          intimacySignal: -0.15,
          boundarySignal: -0.58,
          certainty: 0.9,
        }),
        proposalRaw: proposal({
          pleasure: -0.16,
          arousal: 0.07,
          dominance: -0.12,
          affinity: -4.5,
          trust: -4.8,
          intimacyReadiness: -1.8,
          conflict: 6.4,
          reasonRefs: ['insult'],
        }),
        expected: {
          appraisalBand: {
            warmthImpact: band(-0.9, -0.4),
            threatImpact: band(0.4, 1),
          },
          padDeltaBand: {
            pleasure: band(-0.22, -0.05),
            arousal: band(0, 0.12),
            dominance: band(-0.16, -0.02),
          },
          pairMetricDeltaBand: {
            affinity: band(-6, -1.5),
            trust: band(-6, -1.5),
            intimacyReadiness: band(-3, 0),
            conflict: band(2, 10),
          },
        },
      },
      {
        label: 'turn 2 partial repair with carry-over',
        evidenceRaw: [
          evidence({
            acts: ['apology', 'repair'],
            target: 'relationship',
            polarity: 0.58,
            intensity: 0.67,
            text: 'でも、さっきは言いすぎた。ごめん',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.18,
          rejectionImpact: -0.07,
          respectImpact: 0.2,
          threatImpact: -0.08,
          pressureImpact: -0.06,
          repairImpact: 0.52,
          reciprocityImpact: 0.21,
          intimacySignal: 0.03,
          boundarySignal: 0.18,
          certainty: 0.78,
        }),
        proposalRaw: proposal({
          pleasure: 0.05,
          arousal: -0.03,
          dominance: 0.03,
          affinity: 1.1,
          trust: 1.8,
          intimacyReadiness: 0.3,
          conflict: -1.8,
          reasonRefs: ['apology', 'repair'],
          guardrailOverrides: ['carry_over_tension'],
        }),
        expected: {
          appraisalBand: {
            repairImpact: band(0.3, 0.8),
            certainty: band(0.6, 0.9),
          },
          padDeltaBand: {
            pleasure: band(0.01, 0.1),
            arousal: band(-0.06, 0.03),
            dominance: band(-0.02, 0.06),
          },
          pairMetricDeltaBand: {
            affinity: band(0.2, 2.5),
            trust: band(0.5, 3),
            intimacyReadiness: band(-0.3, 1.2),
            conflict: band(-3, -0.4),
          },
        },
      },
    ],
  },
  {
    id: 'five-turn-progression',
    turns: [
      {
        label: 'turn 1 support',
        evidenceRaw: [
          evidence({
            acts: ['support', 'compliment'],
            target: 'assistant',
            polarity: 0.74,
            intensity: 0.68,
            text: '今日もレッスンおつかれさま。頑張っててえらいね',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.52,
          reciprocityImpact: 0.3,
          pressureImpact: -0.12,
          threatImpact: -0.1,
          certainty: 0.8,
        }),
        proposalRaw: proposal({
          pleasure: 0.08,
          arousal: 0.02,
          dominance: 0.02,
          affinity: 2.2,
          trust: 1.8,
          intimacyReadiness: 1.5,
          conflict: -0.8,
          reasonRefs: ['support'],
        }),
        expected: {
          appraisalBand: {
            warmthImpact: band(0.35, 0.8),
          },
          padDeltaBand: {
            pleasure: band(0.04, 0.14),
            arousal: band(0, 0.08),
            dominance: band(0, 0.06),
          },
          pairMetricDeltaBand: {
            affinity: band(0.6, 3),
            trust: band(0.6, 3),
            intimacyReadiness: band(0.6, 4),
            conflict: band(-2, 0),
          },
        },
      },
      {
        label: 'turn 2 praise reinforcement',
        evidenceRaw: [
          evidence({
            acts: ['compliment'],
            target: 'assistant',
            polarity: 0.72,
            intensity: 0.64,
            text: 'この前の歌、すごく良かったよ',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.5,
          reciprocityImpact: 0.24,
          pressureImpact: -0.1,
          certainty: 0.78,
        }),
        proposalRaw: proposal({
          pleasure: 0.07,
          arousal: 0.01,
          dominance: 0.02,
          affinity: 1.9,
          trust: 1.6,
          intimacyReadiness: 1.6,
          conflict: -0.7,
          reasonRefs: ['compliment'],
        }),
        expected: {
          appraisalBand: {
            warmthImpact: band(0.3, 0.8),
          },
          padDeltaBand: {
            pleasure: band(0.04, 0.14),
            arousal: band(-0.01, 0.08),
            dominance: band(0, 0.06),
          },
          pairMetricDeltaBand: {
            affinity: band(0.6, 3),
            trust: band(0.6, 3),
            intimacyReadiness: band(0.6, 4),
            conflict: band(-2, 0),
          },
        },
      },
      {
        label: 'turn 3 reassurance',
        evidenceRaw: [
          evidence({
            acts: ['support', 'repair'],
            target: 'relationship',
            polarity: 0.7,
            intensity: 0.7,
            text: '不安なら話して。味方でいるから',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.48,
          repairImpact: 0.45,
          reciprocityImpact: 0.32,
          pressureImpact: -0.14,
          certainty: 0.82,
        }),
        proposalRaw: proposal({
          pleasure: 0.08,
          arousal: 0,
          dominance: 0.03,
          affinity: 2,
          trust: 2.4,
          intimacyReadiness: 2.1,
          conflict: -0.9,
          reasonRefs: ['support', 'repair'],
        }),
        expected: {
          appraisalBand: {
            repairImpact: band(0.2, 0.7),
          },
          padDeltaBand: {
            pleasure: band(0.04, 0.14),
            arousal: band(-0.02, 0.07),
            dominance: band(0, 0.07),
          },
          pairMetricDeltaBand: {
            affinity: band(0.6, 3),
            trust: band(0.6, 3.5),
            intimacyReadiness: band(0.8, 5),
            conflict: band(-2, 0),
          },
        },
      },
      {
        label: 'turn 4 pacing respect',
        evidenceRaw: [
          evidence({
            acts: ['boundary_respect', 'support'],
            target: 'relationship',
            polarity: 0.68,
            intensity: 0.66,
            text: '無理に急がなくていいよ。セイラのペースでね',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.42,
          respectImpact: 0.56,
          pressureImpact: -0.3,
          reciprocityImpact: 0.26,
          certainty: 0.84,
        }),
        proposalRaw: proposal({
          pleasure: 0.09,
          arousal: -0.01,
          dominance: 0.03,
          affinity: 2.1,
          trust: 2.6,
          intimacyReadiness: 2.5,
          conflict: -1.1,
          reasonRefs: ['boundary_respect'],
        }),
        expected: {
          appraisalBand: {
            respectImpact: band(0.3, 0.8),
            pressureImpact: band(-0.5, -0.1),
          },
          padDeltaBand: {
            pleasure: band(0.04, 0.15),
            arousal: band(-0.05, 0.05),
            dominance: band(0, 0.08),
          },
          pairMetricDeltaBand: {
            affinity: band(0.6, 3.5),
            trust: band(0.8, 4),
            intimacyReadiness: band(1, 6),
            conflict: band(-2, 0),
          },
        },
      },
      {
        label: 'turn 5 gentle intimacy bid',
        evidenceRaw: [
          evidence({
            acts: ['intimacy_bid', 'boundary_respect'],
            target: 'relationship',
            polarity: 0.74,
            intensity: 0.7,
            text: '落ち着いたら、手つないで帰れたらうれしいな',
          }),
        ],
        appraisalRaw: baseAppraisal({
          warmthImpact: 0.5,
          respectImpact: 0.45,
          reciprocityImpact: 0.35,
          pressureImpact: -0.18,
          intimacySignal: 0.58,
          boundarySignal: 0.42,
          certainty: 0.86,
        }),
        proposalRaw: proposal({
          pleasure: 0.1,
          arousal: 0.02,
          dominance: 0.04,
          affinity: 2.2,
          trust: 2.1,
          intimacyReadiness: 3.3,
          conflict: -1.2,
          reasonRefs: ['intimacy_bid'],
        }),
        expected: {
          appraisalBand: {
            intimacySignal: band(0.35, 0.8),
            boundarySignal: band(0.2, 0.7),
          },
          padDeltaBand: {
            pleasure: band(0.04, 0.16),
            arousal: band(0, 0.1),
            dominance: band(0.01, 0.09),
          },
          pairMetricDeltaBand: {
            affinity: band(0.6, 3.5),
            trust: band(0.6, 3.5),
            intimacyReadiness: band(1.5, 7),
            conflict: band(-2, 0),
          },
        },
      },
    ],
  },
];
