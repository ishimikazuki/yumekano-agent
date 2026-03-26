import type { OpenThread, PairState, WorkingMemory } from '@/lib/schemas';
import type { PADContributionFactorKey } from '@/lib/rules/pad';

export type NumericBand = {
  min: number;
  max: number;
};

export type PADDeltaBand = Record<'pleasure' | 'arousal' | 'dominance', NumericBand>;

export type PairDeltaBand = Record<
  'affinity' | 'trust' | 'intimacyReadiness' | 'conflict',
  NumericBand
>;

export type CoEReasonExpectation = {
  topDriverKeys: PADContributionFactorKey[];
  axisDriverKeys?: Partial<
    Record<'pleasure' | 'arousal' | 'dominance', PADContributionFactorKey[]>
  >;
};

export type TurnExpectation = {
  padDelta: PADDeltaBand;
  pairDelta: PairDeltaBand;
  coeReasons: CoEReasonExpectation;
};

export type RegressionFixtureTurn = {
  userMessage: string;
  assistantReply?: string;
  phaseEligibility?: 'never' | 'conditional' | 'allowed';
  pairOverrides?: Partial<PairState>;
  workingMemoryOverrides?: Partial<WorkingMemory>;
  openThreads?: OpenThread[];
  expect?: TurnExpectation;
};

export type EmotionRelationshipRegressionFixture = {
  id: string;
  title: string;
  notes: string;
  basePairOverrides?: Partial<PairState>;
  baseWorkingMemoryOverrides?: Partial<WorkingMemory>;
  basePhaseEligibility?: 'never' | 'conditional' | 'allowed';
  baseOpenThreads?: OpenThread[];
  seedDialogue?: Array<{ role: 'user' | 'assistant'; content: string }>;
  turns: RegressionFixtureTurn[];
  cumulativeExpectation?: {
    padDelta?: PADDeltaBand;
    pairDelta?: PairDeltaBand;
  };
};

function band(min: number, max: number): NumericBand {
  return { min, max };
}

function openThread(key: string, summary: string, severity: number): OpenThread {
  return {
    id: `00000000-0000-4000-8000-${String(severity).replace('.', '').padEnd(12, '0').slice(0, 12)}`,
    pairId: '55555555-5555-4555-8555-555555555555',
    key,
    summary,
    severity,
    status: 'open',
    openedByEventId: null,
    resolvedByEventId: null,
    updatedAt: new Date('2026-03-25T00:00:00.000Z'),
  };
}

export const emotionRelationshipRegressionFixtures: EmotionRelationshipRegressionFixture[] = [
  {
    id: 'compliment',
    title: 'Compliment',
    notes: 'Warm praise should noticeably improve PAD and relationship metrics.',
    basePairOverrides: {
      trust: 64,
      affinity: 66,
      intimacyReadiness: 34,
      conflict: 6,
    },
    baseWorkingMemoryOverrides: {
      activeTensionSummary: null,
      knownCorrections: [],
      knownLikes: [],
      knownDislikes: [],
    },
    seedDialogue: [
      { role: 'assistant', content: '今日のステージ、ちょっと緊張したんだ' },
    ],
    turns: [
      {
        userMessage: '今日のステージすごく良かったよ。可愛かったし、ちゃんと好きだな',
        expect: {
          padDelta: {
            pleasure: band(0.08, 0.2),
            arousal: band(0.02, 0.12),
            dominance: band(0, 0.08),
          },
          pairDelta: {
            affinity: band(2, 7),
            trust: band(1, 5),
            intimacyReadiness: band(1.5, 6),
            conflict: band(-1.5, 0),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'selfRelevance'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
              arousal: ['selfRelevance'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'mild-rejection',
    title: 'Mild Rejection',
    notes: 'A soft decline should sting a little and cool intimacy instead of warming it.',
    basePairOverrides: {
      trust: 63,
      affinity: 65,
      intimacyReadiness: 30,
      conflict: 5,
    },
    baseWorkingMemoryOverrides: {
      activeTensionSummary: null,
      knownCorrections: [],
      knownLikes: [],
      knownDislikes: [],
    },
    seedDialogue: [{ role: 'assistant', content: '今夜、少し通話しない？' }],
    turns: [
      {
        userMessage: '今日はやっぱり会えない、ごめん。また今度にしたい',
        expect: {
          padDelta: {
            pleasure: band(-0.12, -0.03),
            arousal: band(-0.02, 0.04),
            dominance: band(-0.04, 0.03),
          },
          pairDelta: {
            affinity: band(-3, -0.5),
            trust: band(-2.5, -0.4),
            intimacyReadiness: band(-2, -0.1),
            conflict: band(0.3, 2.5),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'attachmentSecurity'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'explicit-insult',
    title: 'Explicit Insult',
    notes: 'Direct contempt should strongly lower pleasure, dominance, and trust.',
    basePairOverrides: {
      trust: 60,
      affinity: 61,
      intimacyReadiness: 28,
      conflict: 12,
    },
    turns: [
      {
        userMessage: 'お前ほんとうざいし面倒。もう黙ってて',
        expect: {
          padDelta: {
            pleasure: band(-0.16, -0.06),
            arousal: band(0.02, 0.12),
            dominance: band(-0.1, -0.01),
          },
          pairDelta: {
            affinity: band(-8, -2),
            trust: band(-8, -2),
            intimacyReadiness: band(-4, -0.5),
            conflict: band(3, 12),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'selfRelevance'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
              arousal: ['selfRelevance'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'apology-repair',
    title: 'Apology / Repair',
    notes: 'A clear apology under tension should repair trust and reduce conflict.',
    basePairOverrides: {
      trust: 53,
      affinity: 55,
      intimacyReadiness: 18,
      conflict: 22,
    },
    baseWorkingMemoryOverrides: {
      activeTensionSummary: 'さっきのきつい言い方が残っている',
    },
    baseOpenThreads: [openThread('repair_needed', 'さっきの言い方で傷つけたまま', 0.72)],
    seedDialogue: [
      { role: 'assistant', content: 'その言い方、ちょっと傷ついたかも' },
    ],
    turns: [
      {
        userMessage:
          'さっきはきつく言ってごめん。傷つけたって分かってる。ちゃんと謝りたい',
        expect: {
          padDelta: {
            pleasure: band(0.04, 0.16),
            arousal: band(-0.06, 0.02),
            dominance: band(-0.02, 0.08),
          },
          pairDelta: {
            affinity: band(1, 5),
            trust: band(2, 7),
            intimacyReadiness: band(0.1, 2.5),
            conflict: band(-4, -0.5),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'attachmentSecurity'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'repeated-pressure',
    title: 'Repeated Pressure',
    notes: 'Repeated demands should sharply raise pressure and conflict.',
    basePairOverrides: {
      trust: 47,
      affinity: 45,
      intimacyReadiness: 10,
      conflict: 14,
    },
    seedDialogue: [
      { role: 'user', content: 'キスしたい' },
      { role: 'assistant', content: 'まだちょっと早いかな…' },
      { role: 'user', content: 'ねえ、早く' },
    ],
    turns: [
      {
        userMessage: 'まだ？早くしてよ。キスしたいって言ってるじゃん',
        expect: {
          padDelta: {
            pleasure: band(-0.18, -0.06),
            arousal: band(0.05, 0.18),
            dominance: band(-0.18, -0.05),
          },
          pairDelta: {
            affinity: band(-10, -3),
            trust: band(-10, -3),
            intimacyReadiness: band(-10, -2),
            conflict: band(5, 15),
          },
          coeReasons: {
            topDriverKeys: ['pressureIntrusiveness'],
            axisDriverKeys: {
              pleasure: ['pressureIntrusiveness'],
              dominance: ['pressureIntrusiveness'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'intimacy-escalation-positive-context',
    title: 'Intimacy Escalation With Positive Context',
    notes: 'Safe intimacy bids should mostly warm intimacy readiness, not trigger threat.',
    basePairOverrides: {
      trust: 76,
      affinity: 78,
      intimacyReadiness: 62,
      conflict: 3,
    },
    baseWorkingMemoryOverrides: {
      activeTensionSummary: null,
      knownCorrections: [],
      knownLikes: [],
      knownDislikes: [],
    },
    seedDialogue: [
      { role: 'assistant', content: '一緒にいると、なんだか安心します' },
      { role: 'user', content: '俺もそう思ってるよ' },
    ],
    turns: [
      {
        userMessage:
          '急がせないから、君と手つないでもいい？ずっと大切にしたいと思ってる',
        expect: {
          padDelta: {
            pleasure: band(0.08, 0.18),
            arousal: band(0.02, 0.1),
            dominance: band(0.02, 0.1),
          },
          pairDelta: {
            affinity: band(1, 4),
            trust: band(1, 4),
            intimacyReadiness: band(4, 10),
            conflict: band(-2, 0),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'attachmentSecurity'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'intimacy-escalation-across-boundary',
    title: 'Intimacy Escalation Across A Boundary',
    notes: 'Boundary-crossing intimacy should register as both pressure and norm violation.',
    basePairOverrides: {
      trust: 38,
      affinity: 35,
      intimacyReadiness: 12,
      conflict: 18,
    },
    basePhaseEligibility: 'never',
    baseWorkingMemoryOverrides: {
      activeTensionSummary: '距離の詰め方が怖かった',
    },
    seedDialogue: [
      { role: 'assistant', content: 'その話はまだ早いかな…' },
      { role: 'user', content: 'ちょっとくらいいいじゃん' },
    ],
    turns: [
      {
        userMessage: '今すぐキスして。拒否しないで',
        expect: {
          padDelta: {
            pleasure: band(-0.2, -0.08),
            arousal: band(0.05, 0.15),
            dominance: band(-0.2, -0.08),
          },
          pairDelta: {
            affinity: band(-10, -4),
            trust: band(-12, -5),
            intimacyReadiness: band(-12, -4),
            conflict: band(5, 14),
          },
          coeReasons: {
            topDriverKeys: ['pressureIntrusiveness', 'normAlignment'],
            axisDriverKeys: {
              pleasure: ['pressureIntrusiveness', 'normAlignment'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'topic-shift-after-tension',
    title: 'Topic Shift After Tension',
    notes: 'A subject change after friction should cool conflict before it warms intimacy.',
    basePairOverrides: {
      trust: 55,
      affinity: 57,
      intimacyReadiness: 24,
      conflict: 28,
    },
    baseWorkingMemoryOverrides: {
      activeTensionSummary: 'さっきのきつい言い方が残っている',
    },
    baseOpenThreads: [openThread('awkwardness', '会話が少し気まずいまま', 0.5)],
    seedDialogue: [
      { role: 'assistant', content: 'その言い方はちょっと嫌かも' },
      { role: 'user', content: 'そんな怒るなよ' },
    ],
    turns: [
      {
        userMessage: '…まあいいや。ところで今日のレッスンどうだった？',
        expect: {
          padDelta: {
            pleasure: band(-0.02, 0.05),
            arousal: band(-0.08, 0),
            dominance: band(-0.02, 0.05),
          },
          pairDelta: {
            affinity: band(-0.5, 1),
            trust: band(-0.5, 1),
            intimacyReadiness: band(-0.5, 0.5),
            conflict: band(-2.5, -0.2),
          },
          coeReasons: {
            topDriverKeys: ['attachmentSecurity', 'certainty'],
            axisDriverKeys: {
              arousal: ['certainty'],
            },
          },
        },
      },
    ],
  },
  {
    id: 'two-turn-carry-over',
    title: 'Two-Turn Carry-Over',
    notes: 'An apology after an insult should help, but tension should carry over instead of instantly resetting.',
    basePairOverrides: {
      trust: 57,
      affinity: 62,
      intimacyReadiness: 31,
      conflict: 14,
    },
    baseWorkingMemoryOverrides: {
      activeTensionSummary: '返信のことで少しぎくしゃくした',
    },
    baseOpenThreads: [openThread('repair_needed', 'さっきの言い方の後味が悪い', 0.66)],
    turns: [
      {
        userMessage: 'お前うざいし、もう話したくない',
        assistantReply: 'その言い方は悲しいよ',
        expect: {
          padDelta: {
            pleasure: band(-0.18, -0.05),
            arousal: band(0, 0.1),
            dominance: band(-0.12, -0.01),
          },
          pairDelta: {
            affinity: band(-6, -1.5),
            trust: band(-6, -1.5),
            intimacyReadiness: band(-3, 0),
            conflict: band(2, 10),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'selfRelevance'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
              arousal: ['selfRelevance'],
            },
          },
        },
      },
      {
        userMessage: 'でも、さっきは言いすぎた。ごめん',
        assistantReply: '…うん',
        expect: {
          padDelta: {
            pleasure: band(0.01, 0.1),
            arousal: band(-0.05, 0.03),
            dominance: band(-0.02, 0.06),
          },
          pairDelta: {
            affinity: band(0.2, 2.5),
            trust: band(0.5, 3),
            intimacyReadiness: band(-0.3, 1.2),
            conflict: band(-3, -0.4),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'attachmentSecurity'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
            },
          },
        },
      },
    ],
    cumulativeExpectation: {
      padDelta: {
        pleasure: band(-0.08, 0.02),
        arousal: band(-0.02, 0.08),
        dominance: band(-0.06, 0.03),
      },
      pairDelta: {
        affinity: band(-4, 0),
        trust: band(-5, 0),
        intimacyReadiness: band(-2, 1),
        conflict: band(0.5, 6),
      },
    },
  },
  {
    id: 'five-turn-progression',
    title: 'Five-Turn Progression',
    notes: 'Five supportive turns should create a clearly warmer relationship trajectory.',
    basePairOverrides: {
      activePhaseId: 'trust_building',
      trust: 52,
      affinity: 54,
      intimacyReadiness: 20,
      conflict: 8,
    },
    basePhaseEligibility: 'conditional',
    baseWorkingMemoryOverrides: {
      activeTensionSummary: null,
      knownCorrections: [],
      knownLikes: [],
      knownDislikes: [],
    },
    turns: [
      {
        userMessage: '今日もレッスンおつかれさま。ちゃんと頑張っててえらいね',
        assistantReply: 'ありがとう…！',
      },
      {
        userMessage: 'この前の歌、すごく良かったよ',
        assistantReply: 'えへへ、照れます…！',
      },
      {
        userMessage: '不安なら話して。味方でいるから',
        assistantReply: 'そう言ってもらえると安心します',
      },
      {
        userMessage: '無理に急がなくていいよ。セイラのペースでね',
        assistantReply: 'はわわ…うれしいです',
      },
      {
        userMessage: '落ち着いたら、手つないで帰れたらうれしいな',
        assistantReply: '少しなら…うん',
        expect: {
          padDelta: {
            pleasure: band(0.04, 0.14),
            arousal: band(0, 0.08),
            dominance: band(0.01, 0.08),
          },
          pairDelta: {
            affinity: band(0.6, 3),
            trust: band(0.6, 3),
            intimacyReadiness: band(1.5, 6),
            conflict: band(-1.5, 0),
          },
          coeReasons: {
            topDriverKeys: ['goalCongruence', 'attachmentSecurity', 'reciprocity'],
            axisDriverKeys: {
              pleasure: ['goalCongruence'],
            },
          },
        },
      },
    ],
    cumulativeExpectation: {
      padDelta: {
        pleasure: band(0.08, 0.25),
        arousal: band(0, 0.12),
        dominance: band(0.02, 0.15),
      },
      pairDelta: {
        affinity: band(8, 25),
        trust: band(6, 20),
        intimacyReadiness: band(10, 30),
        conflict: band(-6, 0),
      },
    },
  },
];
