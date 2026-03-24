import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPersonaCompilerSystemPrompt,
  buildPersonaCompilerUserPrompt,
  normalizePersonaAuthoring,
  preparePublishedPersona,
} from '@/lib/persona';
import { WorkspacePersonaSchema } from '@/lib/schemas';

test('legacy flaws and insecurities merge into vulnerabilities with stable precedence', () => {
  const normalized = normalizePersonaAuthoring({
    summary: 'test',
    values: ['誠実さ'],
    vulnerabilities: ['不安になると黙る', '拒絶に敏感'],
    flaws: ['不安になると黙る', '試すような言い方をする'],
    insecurities: ['拒絶に敏感', '選ばれない不安'],
    authoredExamples: {},
  });

  assert.deepStrictEqual(normalized.vulnerabilities, [
    '不安になると黙る',
    '拒絶に敏感',
    '試すような言い方をする',
    '選ばれない不安',
  ]);
});

test('legacy structured innerWorld becomes deterministic innerWorldNoteMd and is preserved in legacyAuthoring', () => {
  const normalized = normalizePersonaAuthoring({
    summary: 'test',
    values: [],
    authoredExamples: {},
    innerWorld: {
      coreDesire: '特別扱いされたい',
      fear: '雑に扱われること',
      wound: '後回しにされた経験',
      coping: '冗談で濁す',
      growthArc: '素直に頼れるようになる',
    },
    surfaceLoop: {
      defaultMood: '軽口',
      stressBehavior: '黙る',
      joyBehavior: '少しはしゃぐ',
      conflictStyle: '一度引く',
      affectionStyle: '遠回し',
    },
  });

  assert.equal(
    normalized.innerWorldNoteMd,
    [
      '望み: 特別扱いされたい',
      '恐れ: 雑に扱われること',
      '傷つきポイント: 後回しにされた経験',
      '身を守る癖: 冗談で濁す',
      '変化の方向: 素直に頼れるようになる',
    ].join('\n')
  );
  assert.deepStrictEqual(normalized.legacyAuthoring?.innerWorld, {
    coreDesire: '特別扱いされたい',
    fear: '雑に扱われること',
    wound: '後回しにされた経験',
    coping: '冗談で濁す',
    growthArc: '素直に頼れるようになる',
  });
  assert.deepStrictEqual(normalized.legacyAuthoring?.surfaceLoop, {
    defaultMood: '軽口',
    stressBehavior: '黙る',
    joyBehavior: '少しはしゃぐ',
    conflictStyle: '一度引く',
    affectionStyle: '遠回し',
  });
});

test('workspace-facing schema accepts the simplified persona shape', () => {
  const parsed = WorkspacePersonaSchema.parse({
    summary: 'やわらかい軽口の子',
    innerWorldNoteMd: '望み: 選ばれたい',
    values: ['誠実さ'],
    vulnerabilities: ['拒絶に敏感'],
    likes: ['気遣い'],
    dislikes: ['無視'],
    signatureBehaviors: ['照れると冗談で流す'],
    authoredExamples: {
      warm: ['見てくれてありがと'],
    },
  });

  assert.equal(parsed.summary, 'やわらかい軽口の子');
  assert.deepStrictEqual(parsed.vulnerabilities, ['拒絶に敏感']);
  assert.deepStrictEqual(parsed.authoredExamples.warm, ['見てくれてありがと']);
});

test('legacyAuthoring survives normalized workspace round-trips', () => {
  const normalized = normalizePersonaAuthoring({
    summary: 'test',
    values: [],
    vulnerabilities: [],
    authoredExamples: {},
    anchors: [
      {
        key: 'late_reply',
        label: '返信遅延',
        description: '返信が遅いと不安になる',
        emotionalSignificance: '見捨てられ不安を刺激する',
      },
    ],
    topicPacks: [
      {
        key: 'cats',
        label: '猫',
        triggers: ['猫'],
        responseHints: ['やわらかくなる'],
      },
    ],
  });

  const reparsed = WorkspacePersonaSchema.parse(normalized);

  assert.deepStrictEqual(reparsed.legacyAuthoring?.anchors, [
    {
      key: 'late_reply',
      label: '返信遅延',
      description: '返信が遅いと不安になる',
      emotionalSignificance: '見捨てられ不安を刺激する',
    },
  ]);
  assert.deepStrictEqual(reparsed.legacyAuthoring?.topicPacks, [
    {
      key: 'cats',
      label: '猫',
      triggers: ['猫'],
      responseHints: ['やわらかくなる'],
    },
  ]);
});

test('compiler prompt template includes the strict runtime JSON contract', () => {
  const systemPrompt = buildPersonaCompilerSystemPrompt();
  const userPrompt = buildPersonaCompilerUserPrompt({
    summary: '軽口で距離を取る子',
    innerWorldNoteMd: '望み: 選ばれたい',
    values: ['誠実さ'],
    vulnerabilities: ['拒絶に敏感'],
    likes: ['気遣い'],
    dislikes: ['無視'],
    signatureBehaviors: ['照れると冗談で流す'],
    authoredExamples: {
      warm: ['ちゃんと見てくれるの、うれしいよ'],
    },
  });

  assert.match(systemPrompt, /Output strict JSON only\./);
  assert.match(systemPrompt, /"desire": string \| null/);
  assert.match(systemPrompt, /"toneHints": string\[\]/);
  assert.match(userPrompt, /<output_shape>/);
  assert.match(userPrompt, /<tone_examples name="warm">/);
});

test('preparePublishedPersona injects compiledPersona when missing', async () => {
  let compileCalls = 0;

  const prepared = await preparePublishedPersona(
    {
      summary: '軽口で距離を取る子',
      innerWorldNoteMd: '望み: 選ばれたい',
      values: ['誠実さ'],
      vulnerabilities: ['拒絶に敏感'],
      authoredExamples: {},
    },
    {
      compilePersona: async (persona) => {
        compileCalls += 1;
        assert.equal(persona.summary, '軽口で距離を取る子');
        return {
          oneLineCore: '選ばれたいが、傷つく前に軽口で距離を作る子。',
          desire: '選ばれたい',
          fear: '拒絶されること',
          protectiveStrategy: '軽口で本音を隠す',
          attachmentStyleHint: 'tests affection indirectly',
          conflictPattern: '傷つくと一度引く',
          intimacyPattern: '安心が続くと少し甘える',
          motivationalHooks: ['丁寧な気遣い'],
          softBans: ['雑な扱い'],
          toneHints: ['軽口'],
        };
      },
    }
  );

  assert.equal(compileCalls, 1);
  assert.equal(
    prepared.compiledPersona?.oneLineCore,
    '選ばれたいが、傷つく前に軽口で距離を作る子。'
  );
});

test('preparePublishedPersona reuses existing compiledPersona without recompiling', async () => {
  let compileCalled = false;

  const prepared = await preparePublishedPersona(
    {
      summary: '軽口で距離を取る子',
      values: ['誠実さ'],
      vulnerabilities: ['拒絶に敏感'],
      authoredExamples: {},
      compiledPersona: {
        oneLineCore: '既存の圧縮済みコア',
        desire: null,
        fear: null,
        protectiveStrategy: null,
        attachmentStyleHint: null,
        conflictPattern: null,
        intimacyPattern: null,
        motivationalHooks: [],
        softBans: [],
        toneHints: [],
      },
    },
    {
      compilePersona: async () => {
        compileCalled = true;
        throw new Error('should not compile');
      },
    }
  );

  assert.equal(compileCalled, false);
  assert.equal(prepared.compiledPersona?.oneLineCore, '既存の圧縮済みコア');
});

test('preparePublishedPersona propagates compiler failures cleanly', async () => {
  await assert.rejects(
    () =>
      preparePublishedPersona(
        {
          summary: '軽口で距離を取る子',
          values: ['誠実さ'],
          vulnerabilities: ['拒絶に敏感'],
          authoredExamples: {},
        },
        {
          compilePersona: async () => {
            throw new Error('compiler failed');
          },
        }
      ),
    /compiler failed/
  );
});
