import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderRegistry } from '@/mastra/providers/registry';
import {
  buildCoEEvidenceExtractorSystemPrompt,
  buildCoEEvidenceExtractorUserPrompt,
  parseCoEEvidenceExtractorOutput,
  runCoEEvidenceExtractor,
} from '@/mastra/agents/coe-evidence-extractor';
import {
  createPairState,
  createPhaseNode,
  createWorkingMemory,
} from './persona-test-helpers';

function createInput() {
  return {
    userMessage: '急がせないよ。手つないでもいい？ ちゃんと大切にしたいんだ',
    recentDialogue: [
      { role: 'assistant' as const, content: '一緒にいると安心するね' },
      { role: 'user' as const, content: '俺もそう思ってるよ' },
    ],
    currentPhase: createPhaseNode(),
    pairState: createPairState({
      trust: 71,
      affinity: 73,
      intimacyReadiness: 54,
      conflict: 3,
    }),
    workingMemory: {
      ...createWorkingMemory(),
      activeTensionSummary: null,
      knownCorrections: [],
      knownLikes: ['映画'],
      knownDislikes: [],
    },
    retrievedMemory: {
      facts: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          pairId: '55555555-5555-4555-8555-555555555555',
          subject: 'user',
          predicate: 'values',
          object: 'ゆっくり距離を縮めること',
          confidence: 0.85,
          status: 'active' as const,
          supersededByFactId: null,
          createdAt: new Date('2026-03-25T00:00:00.000Z'),
        },
      ],
      events: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          pairId: '55555555-5555-4555-8555-555555555555',
          eventType: 'support',
          summary: 'User reassured her before the live show.',
          salience: 0.8,
          retrievalKeys: ['support', 'live'],
          emotionSignature: { pleasure: 0.2, arousal: 0.1, dominance: 0.05 },
          participants: ['user', 'character'],
          qualityScore: null,
          supersedesEventId: null,
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
        },
      ],
      observations: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          pairId: '55555555-5555-4555-8555-555555555555',
          summary: 'She opens up more when physical closeness is paced explicitly.',
          retrievalKeys: ['pacing', 'closeness'],
          salience: 0.72,
          qualityScore: null,
          windowStartAt: new Date('2026-03-20T00:00:00.000Z'),
          windowEndAt: new Date('2026-03-24T00:00:00.000Z'),
          createdAt: new Date('2026-03-24T00:00:00.000Z'),
        },
      ],
      threads: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          pairId: '55555555-5555-4555-8555-555555555555',
          key: 'slow_pacing',
          summary: 'She wants closeness to stay paced and safe.',
          severity: 0.3,
          status: 'open' as const,
          openedByEventId: null,
          resolvedByEventId: null,
          updatedAt: new Date('2026-03-25T00:00:00.000Z'),
        },
      ],
    },
    openThreads: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        pairId: '55555555-5555-4555-8555-555555555555',
        key: 'pace_check',
        summary: 'Pacing still matters for physical intimacy.',
        severity: 0.4,
        status: 'open' as const,
        openedByEventId: null,
        resolvedByEventId: null,
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      },
    ],
  };
}

function createMockRegistry(): Pick<ProviderRegistry, 'getModel' | 'getModelInfo'> {
  return {
    getModel: () => ({ mocked: true }),
    getModelInfo: () => ({ provider: 'mock', modelId: 'mock-analysis' }),
  };
}

test('coe evidence extractor prompt includes all required semantic inputs', () => {
  const input = createInput();
  const systemPrompt = buildCoEEvidenceExtractorSystemPrompt(input);
  const userPrompt = buildCoEEvidenceExtractorUserPrompt(input);

  assert.match(systemPrompt, /structured semantic analyzer/i);
  assert.match(userPrompt, /## User Message/);
  assert.match(userPrompt, /## Recent Dialogue/);
  assert.match(userPrompt, /## Current Phase/);
  assert.match(userPrompt, /## Pair State/);
  assert.match(userPrompt, /## Working Memory/);
  assert.match(userPrompt, /## Retrieved Facts/);
  assert.match(userPrompt, /## Retrieved Events/);
  assert.match(userPrompt, /## Retrieved Observations/);
  assert.match(userPrompt, /## Retrieved Threads/);
  assert.match(userPrompt, /## Open Threads/);
});

test('parseCoEEvidenceExtractorOutput rejects malformed interaction acts', () => {
  assert.throws(
    () =>
      parseCoEEvidenceExtractorOutput({
        interactionActs: [
          {
            act: 'compliment',
            target: 'character',
            polarity: 'positive',
            intensity: 0.8,
            confidence: 0.9,
          },
        ],
      }),
    /evidenceSpans/i
  );
});

test('runCoEEvidenceExtractor retries malformed outputs and succeeds with a valid second attempt', async () => {
  const input = createInput();
  const calls: string[] = [];

  const generateObjectImpl = async ({
    prompt,
  }: {
    prompt: string;
  }): Promise<{ object: unknown }> => {
    calls.push(prompt);

    if (calls.length === 1) {
      return {
        object: {
          interactionActs: [
            {
              act: 'compliment',
              target: 'character',
              polarity: 'positive',
              intensity: 0.7,
              confidence: 0.8,
            },
          ],
        },
      };
    }

    return {
      object: {
        interactionActs: [
          {
            act: 'intimacy_bid',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.62,
            confidence: 0.84,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: '手つないでもいい？',
                start: 8,
                end: 17,
              },
            ],
          },
          {
            act: 'boundary_respect',
            target: 'boundary',
            polarity: 'positive',
            intensity: 0.41,
            confidence: 0.76,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: '急がせないよ',
                start: 0,
                end: 6,
              },
            ],
            uncertaintyNotes: ['The bid is warm but still checks a physical boundary.'],
          },
        ],
        confidence: 0.8,
        uncertaintyNotes: ['Physical affection is requested, but pacing language is explicit.'],
      },
    };
  };

  const result = await runCoEEvidenceExtractor(input, {
    generateObjectImpl,
    registry: createMockRegistry(),
    maxAttempts: 2,
  });

  assert.equal(result.attempts, 2);
  assert.equal(result.modelId, 'mock/mock-analysis');
  assert.equal(result.extraction.interactionActs.length, 2);
  assert.equal(result.extraction.interactionActs[0].act, 'intimacy_bid');
  assert.ok(result.extraction.relationalAppraisal);
  assert.ok(
    result.extraction.uncertaintyNotes.some((note) =>
      /relationalAppraisal was missing/i.test(note)
    )
  );
  assert.match(calls[1], /previous output was invalid/i);
});

test('runCoEEvidenceExtractor returns a safe fallback after exhausting retries', async () => {
  const input = createInput();

  const result = await runCoEEvidenceExtractor(input, {
    generateObjectImpl: async () => ({
      object: {
        interactionActs: [
          {
            act: 'compliment',
            target: 'character',
            polarity: 'positive',
            intensity: 0.5,
          },
        ],
      },
    }),
    registry: createMockRegistry(),
    maxAttempts: 2,
  });

  assert.equal(result.attempts, 2);
  assert.equal(result.extraction.interactionActs.length, 1);
  assert.equal(result.extraction.interactionActs[0].act, 'other');
  assert.ok(
    result.extraction.uncertaintyNotes.some((note) =>
      /safe fallback used after malformed extractor output/i.test(note)
    )
  );
});
