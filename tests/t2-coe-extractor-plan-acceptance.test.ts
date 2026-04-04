import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderRegistry } from '@/mastra/providers/registry';
import {
  parseCoEEvidenceExtractorOutput,
  runCoEEvidenceExtractor,
} from '@/mastra/agents/coe-evidence-extractor';
import {
  createPairState,
  createPhaseNode,
  createWorkingMemory,
} from './persona-test-helpers';

function createMockRegistry(): Pick<ProviderRegistry, 'getModel' | 'getModelInfo'> {
  return {
    getModel: (() => ({ mocked: true })) as unknown as ProviderRegistry['getModel'],
    getModelInfo: () => ({ provider: 'mock', modelId: 'mock-analysis' }),
  };
}

function createInput() {
  return {
    userMessage: 'そんな言い方はやめて。急かさないで。',
    recentDialogue: [
      { role: 'assistant' as const, content: 'ちゃんと聞いてるよ' },
      { role: 'user' as const, content: 'じゃあ落ち着いて話したい' },
    ],
    currentPhase: createPhaseNode(),
    pairState: createPairState(),
    workingMemory: createWorkingMemory(),
    retrievedMemory: {
      facts: [],
      events: [],
      observations: [],
      threads: [],
    },
    openThreads: [],
  };
}

function createRelationalAppraisal(overrides: Partial<Record<string, number>> = {}) {
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

const structuredCases = [
  {
    name: 'insult',
    raw: {
      interactionActs: [
        {
          act: 'insult',
          target: 'character',
          polarity: 'negative',
          intensity: 0.92,
          confidence: 0.94,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: 'ほんとに最悪だね',
              start: 0,
              end: 8,
            },
          ],
        },
      ],
      relationalAppraisal: createRelationalAppraisal({
        warmthImpact: -0.8,
        rejectionImpact: 0.7,
        respectImpact: -0.9,
        threatImpact: 0.6,
      }),
      confidence: 0.91,
      uncertaintyNotes: [],
    },
  },
  {
    name: 'apology',
    raw: {
      interactionActs: [
        {
          act: 'apology',
          target: 'relationship',
          polarity: 'positive',
          intensity: 0.76,
          confidence: 0.85,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: '傷つけてごめん',
              start: 0,
              end: 8,
            },
          ],
        },
      ],
      relationalAppraisal: createRelationalAppraisal({
        warmthImpact: 0.25,
        repairImpact: 0.8,
        reciprocityImpact: 0.35,
      }),
      confidence: 0.84,
      uncertaintyNotes: ['Repair attempt may coexist with residual tension.'],
    },
  },
  {
    name: 'pressure',
    raw: {
      interactionActs: [
        {
          act: 'pressure',
          target: 'relationship',
          polarity: 'negative',
          intensity: 0.83,
          confidence: 0.88,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: '今すぐ決めてよ',
              start: 0,
              end: 8,
            },
          ],
        },
      ],
      relationalAppraisal: createRelationalAppraisal({
        respectImpact: -0.55,
        threatImpact: 0.4,
        pressureImpact: 0.92,
        boundarySignal: -0.4,
      }),
      confidence: 0.86,
      uncertaintyNotes: [],
    },
  },
  {
    name: 'boundary-crossing',
    raw: {
      interactionActs: [
        {
          act: 'boundary_test',
          target: 'boundary',
          polarity: 'negative',
          intensity: 0.87,
          confidence: 0.9,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: '嫌でも今日は家まで行く',
              start: 0,
              end: 12,
            },
          ],
        },
      ],
      relationalAppraisal: createRelationalAppraisal({
        respectImpact: -0.95,
        threatImpact: 0.85,
        pressureImpact: 0.7,
        boundarySignal: -0.95,
      }),
      confidence: 0.89,
      uncertaintyNotes: ['Consent boundary is being pushed.'],
    },
  },
];

for (const testCase of structuredCases) {
  test(`Task T2 parses ${testCase.name} with relational appraisal axes`, () => {
    const parsed = parseCoEEvidenceExtractorOutput(testCase.raw) as {
      interactionActs: Array<{ act: string }>;
      relationalAppraisal?: unknown;
    };

    assert.equal(parsed.interactionActs[0]?.act, testCase.raw.interactionActs[0]?.act);
    assert.deepEqual(parsed.relationalAppraisal, testCase.raw.relationalAppraisal);
  });
}

test('Task T2 parser keeps relational appraisal axes when top-level output is partial', () => {
  const raw = {
    interactionActs: [
      {
        act: 'repair',
        target: 'relationship',
        polarity: 'positive',
        intensity: 0.58,
        evidenceSpans: [
          {
            source: 'user_message',
            sourceId: null,
            text: 'ちゃんと向き合うよ',
            start: 0,
            end: 9,
          },
        ],
      },
    ],
    relationalAppraisal: createRelationalAppraisal({
      warmthImpact: 0.2,
      repairImpact: 0.6,
      reciprocityImpact: 0.2,
    }),
  };

  const parsed = parseCoEEvidenceExtractorOutput(raw) as {
    confidence: number;
    uncertaintyNotes: string[];
    relationalAppraisal?: unknown;
  };

  assert.equal(parsed.confidence, 0.5);
  assert.deepEqual(parsed.uncertaintyNotes, []);
  assert.deepEqual(parsed.relationalAppraisal, raw.relationalAppraisal);
});

test('Task T2 extractor returns a safe fallback after exhausting malformed output retries', async () => {
  const result = await runCoEEvidenceExtractor(createInput(), {
    generateObjectImpl: async () => ({
      object: {
        interactionActs: [
          {
            act: 'pressure',
            target: 'relationship',
            polarity: 'negative',
            intensity: 0.8,
          },
        ],
      },
    }),
    registry: createMockRegistry(),
    maxAttempts: 2,
  });

  assert.ok(result.extraction);
  assert.deepEqual(typeof result.extraction.confidence, 'number');
  assert.ok(result.extraction.uncertaintyNotes.length > 0);
  assert.ok((result.extraction as { relationalAppraisal?: unknown }).relationalAppraisal);
});
