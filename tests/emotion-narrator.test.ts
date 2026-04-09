import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { traceRepo } from '@/lib/repositories/trace-repo';
import { EmotionNarrativeSchema } from '@/lib/schemas/narrative';
import { runEmotionNarrator } from '@/mastra/agents/emotion-narrator';
import { generateNarrativeAsync } from '@/mastra/workflows/execute-turn';

test('EmotionNarrativeSchema accepts valid narrative', () => {
  const valid = {
    characterNarrative: 'ユーザーの素直な愛情表現を受けて、快感情が上昇した。',
    relationshipNarrative: '信頼が微増し、親密さへの準備度が前進した。',
    drivers: ['素直な愛情表現 → 快感情 +0.23'],
  };
  const result = EmotionNarrativeSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test('EmotionNarrativeSchema rejects empty characterNarrative', () => {
  const invalid = {
    characterNarrative: '',
    relationshipNarrative: '信頼が微増。',
    drivers: ['driver'],
  };
  const result = EmotionNarrativeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('EmotionNarrativeSchema rejects empty drivers array', () => {
  const invalid = {
    characterNarrative: 'some text',
    relationshipNarrative: 'some text',
    drivers: [],
  };
  const result = EmotionNarrativeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('EmotionNarrativeSchema rejects more than 3 drivers', () => {
  const invalid = {
    characterNarrative: 'some text',
    relationshipNarrative: 'some text',
    drivers: ['a', 'b', 'c', 'd'],
  };
  const result = EmotionNarrativeSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

const TRACE_TABLE_DDL = `
  CREATE TABLE turn_traces (
    id TEXT PRIMARY KEY,
    pair_id TEXT NOT NULL,
    character_version_id TEXT NOT NULL,
    prompt_bundle_version_id TEXT NOT NULL,
    model_ids_json TEXT NOT NULL,
    phase_id_before TEXT NOT NULL,
    phase_id_after TEXT NOT NULL,
    emotion_before_json TEXT NOT NULL,
    emotion_after_json TEXT NOT NULL,
    emotion_state_before_json TEXT,
    emotion_state_after_json TEXT,
    relationship_before_json TEXT,
    relationship_after_json TEXT,
    relationship_deltas_json TEXT,
    phase_transition_evaluation_json TEXT,
    prompt_assembly_hashes_json TEXT,
    appraisal_json TEXT NOT NULL,
    retrieved_memory_ids_json TEXT NOT NULL,
    coe_extraction_json TEXT,
    emotion_trace_json TEXT,
    legacy_comparison_json TEXT,
    memory_threshold_decisions_json TEXT,
    coe_contributions_json TEXT,
    plan_json TEXT NOT NULL,
    candidates_json TEXT NOT NULL,
    winner_index INTEGER NOT NULL,
    memory_writes_json TEXT NOT NULL,
    user_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    narrative_json TEXT DEFAULT NULL,
    created_at TEXT NOT NULL
  )
`;

function makeMinimalTraceInput(id: string) {
  const pad = { pleasure: 0, arousal: 0, dominance: 0 };
  const runtimeEmotion = { fastAffect: pad, slowMood: pad, combined: pad, lastUpdatedAt: new Date() };
  const metrics = { affinity: 50, trust: 50, intimacyReadiness: 0, conflict: 0 };
  return {
    id,
    pairId: '11111111-1111-4111-8111-111111111111',
    characterVersionId: '22222222-2222-4222-8222-222222222222',
    promptBundleVersionId: '33333333-3333-4333-8333-333333333333',
    modelIds: { planner: 'm', generator: 'm', ranker: 'm', extractor: 'm' },
    phaseIdBefore: 'p1',
    phaseIdAfter: 'p1',
    emotionBefore: pad,
    emotionAfter: pad,
    emotionStateBefore: runtimeEmotion,
    emotionStateAfter: runtimeEmotion,
    relationshipBefore: metrics,
    relationshipAfter: metrics,
    relationshipDeltas: { affinity: 0, trust: 0, intimacyReadiness: 0, conflict: 0 },
    phaseTransitionEvaluation: {
      shouldTransition: false, targetPhaseId: null, reason: 'none',
      satisfiedConditions: [], failedConditions: [],
    },
    promptAssemblyHashes: { planner: '', generator: '', ranker: '', extractor: '' },
    appraisal: {
      goalCongruence: 0, controllability: 0.5, certainty: 0.5,
      normAlignment: 0, attachmentSecurity: 0.5, reciprocity: 0,
      pressureIntrusiveness: 0, novelty: 0.5, selfRelevance: 0.5,
    },
    retrievedMemoryIds: { events: [], facts: [], observations: [], threads: [] },
    memoryThresholdDecisions: [],
    coeContributions: [],
    plan: {
      stance: 'neutral',
      primaryActs: ['acknowledge'],
      secondaryActs: [],
      memoryFocus: { emphasize: [], suppress: [], reason: 'none' },
      phaseTransitionProposal: { shouldTransition: false, targetPhaseId: null, reason: 'none' },
      intimacyDecision: 'not_applicable',
      emotionDeltaIntent: { pleasureDelta: 0, arousalDelta: 0, dominanceDelta: 0, reason: 'none' },
      plannerReasoning: 'test',
      mustAvoid: [],
    },
    candidates: [{
      index: 0, text: 'hi', toneTags: [], memoryRefsUsed: [], riskFlags: [],
      scores: {
        personaConsistency: 1, phaseCompliance: 1, memoryGrounding: 1,
        emotionalCoherence: 1, autonomy: 1, naturalness: 1, overall: 1,
      },
      rejected: false, rejectionReason: null,
    }],
    winnerIndex: 0,
    memoryWrites: [],
    userMessage: 'hello',
    assistantMessage: 'hi',
  };
}

test('updateTraceNarrative writes and getTraceById reads narrative_json', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-narrator-'));
  const dbPath = path.join(tempDir, 'narrator.db');
  const prevDb = process.env.DATABASE_URL;
  const prevLocal = process.env.LOCAL_DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

  try {
    const db = getDb();
    await db.execute(TRACE_TABLE_DDL);

    const traceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await traceRepo.createTrace(makeMinimalTraceInput(traceId));

    // Before update: narrative should be null
    const before = await traceRepo.getTraceById(traceId);
    assert.ok(before);
    assert.equal(before.narrativeJson, null);

    const narrative = {
      characterNarrative: '快感情が上昇した。',
      relationshipNarrative: '信頼が微増。',
      drivers: ['愛情表現 → 快 +0.2'],
    };
    await traceRepo.updateTraceNarrative(traceId, narrative);

    const after = await traceRepo.getTraceById(traceId);
    assert.ok(after);
    assert.deepEqual(after.narrativeJson, narrative);
  } finally {
    process.env.DATABASE_URL = prevDb;
    process.env.LOCAL_DATABASE_URL = prevLocal;
    await getDb().close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('runEmotionNarrator returns valid EmotionNarrative (stubbed LLM)', async () => {
  const fakeNarrative = {
    characterNarrative: 'ユーザーの愛情表現を受けて快感情が上昇。',
    relationshipNarrative: '信頼が微増した。',
    drivers: ['affection → 快 +0.2'],
  };

  const result = await runEmotionNarrator(
    {
      userMessage: '一緒にいたいな',
      assistantMessage: 'うん、私も',
      interactionActs: [{
        act: 'affection',
        target: 'partner',
        polarity: 'positive',
        intensity: 0.7,
        evidenceSpans: [{ source: 'user_message', sourceId: null, text: '一緒にいたいな', start: 0, end: 7 }],
        confidence: 0.9,
        uncertaintyNotes: [],
      }],
      relationalAppraisal: {
        warmthImpact: 0.6, rejectionImpact: 0, respectImpact: 0.2,
        threatImpact: 0, pressureImpact: 0, repairImpact: 0,
        reciprocityImpact: 0.3, intimacySignal: 0.5, boundarySignal: 0, certainty: 0.8,
      },
      emotionBefore: { pleasure: 0.1, arousal: 0.0, dominance: 0.0 },
      emotionAfter: { pleasure: 0.33, arousal: 0.15, dominance: 0.0 },
      relationshipBefore: { affinity: 55, trust: 50, intimacyReadiness: 20, conflict: 5 },
      relationshipAfter: { affinity: 58, trust: 52, intimacyReadiness: 23, conflict: 4 },
      characterName: 'ミク',
      currentPhaseId: 'getting_closer',
    },
    {
      generateObject: async () => ({ object: fakeNarrative }),
    }
  );

  assert.equal(result.characterNarrative, fakeNarrative.characterNarrative);
  assert.equal(result.relationshipNarrative, fakeNarrative.relationshipNarrative);
  assert.deepEqual(result.drivers, fakeNarrative.drivers);
});

test('generateNarrativeAsync does not throw on narrator failure', async () => {
  const failingNarrator = async () => {
    throw new Error('LLM unavailable');
  };
  const logs: string[] = [];
  const fakeConsoleError = (...args: unknown[]) => logs.push(String(args[0]));

  await generateNarrativeAsync(
    {
      traceId: 'test-trace-id',
      userMessage: 'hello',
      assistantMessage: 'hi',
      interactionActs: [],
      relationalAppraisal: {
        warmthImpact: 0, rejectionImpact: 0, respectImpact: 0,
        threatImpact: 0, pressureImpact: 0, repairImpact: 0,
        reciprocityImpact: 0, intimacySignal: 0, boundarySignal: 0, certainty: 0,
      },
      emotionBefore: { pleasure: 0, arousal: 0, dominance: 0 },
      emotionAfter: { pleasure: 0, arousal: 0, dominance: 0 },
      relationshipBefore: { affinity: 50, trust: 50, intimacyReadiness: 0, conflict: 0 },
      relationshipAfter: { affinity: 50, trust: 50, intimacyReadiness: 0, conflict: 0 },
      characterName: 'test',
      currentPhaseId: 'test',
    },
    {
      runNarrator: failingNarrator,
      updateNarrative: async () => {},
      logError: fakeConsoleError,
    }
  );

  assert.ok(logs.some((l) => l.includes('Narrative generation failed')));
});

test('generateNarrativeAsync calls updateNarrative on success', async () => {
  const narrative = {
    characterNarrative: 'test',
    relationshipNarrative: 'test',
    drivers: ['test'],
  };
  let savedTraceId = '';
  let savedNarrative: unknown = null;

  await generateNarrativeAsync(
    {
      traceId: 'abc-123',
      userMessage: 'hi',
      assistantMessage: 'hello',
      interactionActs: [],
      relationalAppraisal: {
        warmthImpact: 0, rejectionImpact: 0, respectImpact: 0,
        threatImpact: 0, pressureImpact: 0, repairImpact: 0,
        reciprocityImpact: 0, intimacySignal: 0, boundarySignal: 0, certainty: 0,
      },
      emotionBefore: { pleasure: 0, arousal: 0, dominance: 0 },
      emotionAfter: { pleasure: 0, arousal: 0, dominance: 0 },
      relationshipBefore: { affinity: 50, trust: 50, intimacyReadiness: 0, conflict: 0 },
      relationshipAfter: { affinity: 50, trust: 50, intimacyReadiness: 0, conflict: 0 },
      characterName: 'test',
      currentPhaseId: 'test',
    },
    {
      runNarrator: async () => narrative,
      updateNarrative: async (id, n) => { savedTraceId = id; savedNarrative = n; },
      logError: () => {},
    }
  );

  assert.equal(savedTraceId, 'abc-123');
  assert.deepEqual(savedNarrative, narrative);
});
