# Emotion Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace formulaic hardcoded emotion logs with LLM-generated natural-language narratives, produced asynchronously after the chat response is sent.

**Architecture:** A new `runEmotionNarrator` agent generates third-person emotion summaries using the rich CoE extraction data already available in `executeTurn`. The narrative is fire-and-forget after trace persistence — chat response latency is unaffected. A new `narrative_json` column on `turn_traces` stores the result; the dashboard falls back to the existing template text when the narrative is NULL.

**Tech Stack:** TypeScript, Zod, AI SDK (`generateObject`), libSQL, node:test, React (client component)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/schemas/narrative.ts` | Zod schema + type for `EmotionNarrative` |
| Create | `src/mastra/agents/emotion-narrator.ts` | LLM agent that generates narratives |
| Create | `supabase/migrations/20260409000001_add_narrative_json.sql` | DB migration |
| Create | `tests/emotion-narrator.test.ts` | Schema + repo + async safety tests |
| Modify | `src/lib/repositories/trace-repo.ts` | Add `updateTraceNarrative` + read `narrative_json` in `getTraceById`/`getTracesByPair` |
| Modify | `src/mastra/workflows/execute-turn.ts` | Add persistence interface method + fire-and-forget call |
| Modify | `src/mastra/workflows/chat-turn.ts` | Wire `updateTraceNarrative` into persistence |
| Modify | `src/components/CoEExplanationCard.tsx` | Conditional rendering: narrative vs fallback |
| Modify | `src/app/(dashboard)/traces/[id]/page.tsx` | Pass `narrative` to `CoEExplanationCard` |
| Modify | `src/app/api/traces/[id]/route.ts` | Return `narrativeJson` in API response |

---

### Task 1: Zod Schema for EmotionNarrative

**Files:**
- Create: `src/lib/schemas/narrative.ts`
- Create: `tests/emotion-narrator.test.ts`

- [ ] **Step 1: Write the schema**

```typescript
// src/lib/schemas/narrative.ts
import { z } from 'zod';

export const EmotionNarrativeSchema = z.object({
  characterNarrative: z.string().min(1),
  relationshipNarrative: z.string().min(1),
  drivers: z.array(z.string().min(1)).min(1).max(3),
});

export type EmotionNarrative = z.infer<typeof EmotionNarrativeSchema>;
```

- [ ] **Step 2: Write the schema validation test**

```typescript
// tests/emotion-narrator.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { EmotionNarrativeSchema } from '@/lib/schemas/narrative';

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
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas/narrative.ts tests/emotion-narrator.test.ts
git commit -m "feat: add EmotionNarrative Zod schema and validation tests"
```

---

### Task 2: DB Migration + Repository Methods

**Files:**
- Create: `supabase/migrations/20260409000001_add_narrative_json.sql`
- Modify: `src/lib/repositories/trace-repo.ts`
- Modify: `tests/emotion-narrator.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260409000001_add_narrative_json.sql
ALTER TABLE turn_traces ADD COLUMN narrative_json TEXT DEFAULT NULL;
```

- [ ] **Step 2: Write the failing test for updateTraceNarrative**

Append to `tests/emotion-narrator.test.ts`:

```typescript
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getDb } from '@/lib/db/client';
import { traceRepo } from '@/lib/repositories/trace-repo';

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
      shouldTransition: false,
      targetPhaseId: null,
      reason: 'none',
      satisfiedConditions: [],
      failedConditions: [],
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
      primaryActs: [],
      secondaryActs: [],
      intimacyDecision: 'none',
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
    assert.equal((before as any).narrativeJson, undefined);

    const narrative = {
      characterNarrative: '快感情が上昇した。',
      relationshipNarrative: '信頼が微増。',
      drivers: ['愛情表現 → 快 +0.2'],
    };
    await traceRepo.updateTraceNarrative(traceId, narrative);

    const after = await traceRepo.getTraceById(traceId);
    assert.ok(after);
    assert.deepEqual((after as any).narrativeJson, narrative);
  } finally {
    process.env.DATABASE_URL = prevDb;
    process.env.LOCAL_DATABASE_URL = prevLocal;
    await getDb().close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: FAIL — `traceRepo.updateTraceNarrative is not a function` and `narrativeJson` undefined

- [ ] **Step 4: Implement updateTraceNarrative in trace-repo.ts**

Add to `traceRepo` object in `src/lib/repositories/trace-repo.ts`:

```typescript
  async updateTraceNarrative(
    traceId: string,
    narrative: { characterNarrative: string; relationshipNarrative: string; drivers: string[] }
  ): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE turn_traces SET narrative_json = ? WHERE id = ?`,
      args: [JSON.stringify(narrative), traceId],
    });
  },
```

Also update `getTraceById` to read `narrative_json`:

After the existing `createdAt: row.created_at,` line in `getTraceById`, the returned object won't include `narrativeJson` by default since `TurnTraceSchema` doesn't have it. Instead, read it separately and return it alongside the parsed trace. Update the return type and parsing:

In `getTraceById`, after the `TurnTraceSchema.parse(...)` call, add:

```typescript
    const narrativeRaw = row.narrative_json as string | null;
    return {
      ...parsed,
      narrativeJson: narrativeRaw ? (JSON.parse(narrativeRaw) as import('../schemas/narrative').EmotionNarrative) : null,
    };
```

Change the method signature to return `Promise<(TurnTrace & { narrativeJson: import('../schemas/narrative').EmotionNarrative | null }) | null>`.

Do the same in `getTracesByPair`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run existing trace-repo tests to check no regressions**

Run: `npx tsx --test tests/trace-repo.test.ts`
Expected: PASS (existing tests use inline DDL without `narrative_json` column — they should still pass since `createTrace` doesn't write `narrative_json`)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260409000001_add_narrative_json.sql \
        src/lib/repositories/trace-repo.ts \
        tests/emotion-narrator.test.ts
git commit -m "feat: add narrative_json column and updateTraceNarrative repo method"
```

---

### Task 3: Emotion Narrator Agent

**Files:**
- Create: `src/mastra/agents/emotion-narrator.ts`
- Modify: `tests/emotion-narrator.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/emotion-narrator.test.ts`:

```typescript
import { runEmotionNarrator } from '@/mastra/agents/emotion-narrator';
import { EmotionNarrativeSchema } from '@/lib/schemas/narrative';

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

  const parsed = EmotionNarrativeSchema.safeParse(result);
  assert.equal(parsed.success, true);
  assert.equal(result.characterNarrative, fakeNarrative.characterNarrative);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: FAIL — `Cannot find module '@/mastra/agents/emotion-narrator'`

- [ ] **Step 3: Implement the emotion narrator agent**

```typescript
// src/mastra/agents/emotion-narrator.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { EmotionNarrativeSchema, type EmotionNarrative } from '@/lib/schemas/narrative';
import { getProviderRegistry, type ProviderRegistry } from '../providers/registry';
import type {
  ExtractedInteractionAct,
  RelationalAppraisal,
  PADState,
  RelationshipMetrics,
} from '@/lib/schemas';

export type EmotionNarratorInput = {
  userMessage: string;
  assistantMessage: string;
  interactionActs: ExtractedInteractionAct[];
  relationalAppraisal: RelationalAppraisal;
  emotionBefore: PADState;
  emotionAfter: PADState;
  relationshipBefore: RelationshipMetrics;
  relationshipAfter: RelationshipMetrics;
  characterName: string;
  currentPhaseId: string;
};

type NarratorGenerateObject = (input: {
  model: unknown;
  schema: z.ZodTypeAny;
  system: string;
  prompt: string;
}) => Promise<{ object: unknown }>;

type NarratorDeps = {
  generateObject?: NarratorGenerateObject;
  registry?: Pick<ProviderRegistry, 'getModel' | 'getModelInfo'>;
};

function formatPADDelta(before: PADState, after: PADState): string {
  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
  return `快${fmt(after.pleasure - before.pleasure)} / 覚醒${fmt(after.arousal - before.arousal)} / 支配感${fmt(after.dominance - before.dominance)}`;
}

function formatRelDelta(before: RelationshipMetrics, after: RelationshipMetrics): string {
  const parts: string[] = [];
  const d = (key: keyof RelationshipMetrics) => {
    const diff = after[key] - before[key];
    if (Math.abs(diff) >= 0.5) parts.push(`${key}: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`);
  };
  d('affinity');
  d('trust');
  d('intimacyReadiness');
  d('conflict');
  return parts.length > 0 ? parts.join(', ') : 'ほぼ変化なし';
}

const SYSTEM_PROMPT = `あなたは感情分析レポーターです。チャットターンの感情変化を、第三者の客観的な視点で簡潔に日本語で報告してください。

## 出力ルール
- characterNarrative: キャラクターの感情がどう変化したかを1〜3文で。ユーザーの具体的な発言を引用して因果を示す。
- relationshipNarrative: 関係性指標への影響を1文で。
- drivers: 感情変化の主要ドライバーを1〜3個。「{行為} → {軸} {変化量}」の形式。

## 制約
- 第三者の客観的な視点で書く（キャラ一人称NG）
- 抽象的な表現を避け、具体的な発言やaction actを参照する
- 各フィールドは必ず日本語で書く`;

export async function runEmotionNarrator(
  input: EmotionNarratorInput,
  deps: NarratorDeps = {}
): Promise<EmotionNarrative> {
  const gen = deps.generateObject ?? generateObject;
  const registry = deps.registry ?? getProviderRegistry();

  const actsText = input.interactionActs
    .map((act) => {
      const spans = act.evidenceSpans.map((s) => `"${s.text}"`).join(', ');
      return `- ${act.act} (${act.polarity}, intensity=${act.intensity.toFixed(2)}): ${spans}`;
    })
    .join('\n');

  const appraisalText = Object.entries(input.relationalAppraisal)
    .map(([key, val]) => `${key}: ${(val as number).toFixed(2)}`)
    .join(', ');

  const prompt = `## ターンデータ

ユーザー発言: "${input.userMessage}"
キャラクター応答: "${input.assistantMessage}"
キャラクター名: ${input.characterName}
フェーズ: ${input.currentPhaseId}

## 抽出された行為
${actsText}

## 関係性評価
${appraisalText}

## 感情変化 (PAD)
${formatPADDelta(input.emotionBefore, input.emotionAfter)}
Before: P=${input.emotionBefore.pleasure.toFixed(2)} A=${input.emotionBefore.arousal.toFixed(2)} D=${input.emotionBefore.dominance.toFixed(2)}
After:  P=${input.emotionAfter.pleasure.toFixed(2)} A=${input.emotionAfter.arousal.toFixed(2)} D=${input.emotionAfter.dominance.toFixed(2)}

## 関係性指標変化
${formatRelDelta(input.relationshipBefore, input.relationshipAfter)}

上記データに基づき、感情変化の要約を生成してください。`;

  const { object } = await gen({
    model: registry.getModel('analysisMedium'),
    schema: EmotionNarrativeSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return EmotionNarrativeSchema.parse(object);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/mastra/agents/emotion-narrator.ts tests/emotion-narrator.test.ts
git commit -m "feat: add runEmotionNarrator agent with stubbed LLM test"
```

---

### Task 4: Wire Async Narrative Generation into executeTurn

**Files:**
- Modify: `src/mastra/workflows/execute-turn.ts`
- Modify: `src/mastra/workflows/chat-turn.ts`
- Modify: `tests/emotion-narrator.test.ts`

- [ ] **Step 1: Write the failing test for fire-and-forget safety**

Append to `tests/emotion-narrator.test.ts`:

```typescript
import { generateNarrativeAsync } from '@/mastra/workflows/execute-turn';

test('generateNarrativeAsync does not throw on narrator failure', async () => {
  const failingNarrator = async () => {
    throw new Error('LLM unavailable');
  };
  const logs: string[] = [];
  const fakeConsoleError = (...args: unknown[]) => logs.push(String(args[0]));

  // Should not throw
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: FAIL — `Cannot find module` or `generateNarrativeAsync is not a function`

- [ ] **Step 3: Add generateNarrativeAsync to execute-turn.ts**

Add at the bottom of `src/mastra/workflows/execute-turn.ts`, before the closing of the file:

```typescript
import type { EmotionNarrative } from '@/lib/schemas/narrative';
import type { EmotionNarratorInput } from '../agents/emotion-narrator';

export type GenerateNarrativeAsyncInput = EmotionNarratorInput & {
  traceId: string;
};

type GenerateNarrativeAsyncDeps = {
  runNarrator: (input: EmotionNarratorInput) => Promise<EmotionNarrative>;
  updateNarrative: (traceId: string, narrative: EmotionNarrative) => Promise<void>;
  logError?: (...args: unknown[]) => void;
};

export async function generateNarrativeAsync(
  input: GenerateNarrativeAsyncInput,
  deps: GenerateNarrativeAsyncDeps
): Promise<void> {
  const log = deps.logError ?? console.error;
  try {
    const { traceId, ...narratorInput } = input;
    const narrative = await deps.runNarrator(narratorInput);
    await deps.updateNarrative(traceId, narrative);
  } catch (err) {
    log('Narrative generation failed:', err);
  }
}
```

- [ ] **Step 4: Add persistence interface method and fire-and-forget call in executeTurn**

In `ExecuteTurnInput.persistence`, add the optional method:

```typescript
    updateTraceNarrative?(traceId: string, narrative: import('@/lib/schemas/narrative').EmotionNarrative): Promise<void>;
```

At the end of `executeTurn`, after `maybeConsolidate` and before the `return`, add:

```typescript
  // Fire-and-forget: generate narrative asynchronously
  if (input.persistence.updateTraceNarrative) {
    const { runEmotionNarrator: narratorFn } = await import('../agents/emotion-narrator');
    generateNarrativeAsync(
      {
        traceId,
        userMessage: input.userMessage,
        assistantMessage,
        interactionActs: coeExtraction.interactionActs,
        relationalAppraisal: coeExtraction.relationalAppraisal,
        emotionBefore,
        emotionAfter,
        relationshipBefore,
        relationshipAfter,
        characterName: input.characterVersion.name,
        currentPhaseId: phaseIdAfter,
      },
      {
        runNarrator: narratorFn,
        updateNarrative: input.persistence.updateTraceNarrative,
      }
    ).catch(() => {}); // Double safety net — generateNarrativeAsync already catches
  }
```

Note: The `await import(...)` is used to avoid circular dependency issues at module load time. The `.catch(() => {})` on the unresolved promise prevents unhandled rejection warnings.

- [ ] **Step 5: Wire updateTraceNarrative in chat-turn.ts**

In `src/mastra/workflows/chat-turn.ts`, inside the `persistence` object passed to `executeTurnRunner(...)`, add after `maybeConsolidate`:

```typescript
      updateTraceNarrative: async (traceId, narrative) => {
        await repos.traceRepo.updateTraceNarrative(traceId, narrative);
      },
```

Update the `ChatTurnRepos.traceRepo` Pick type to include `'updateTraceNarrative'`:

```typescript
  traceRepo: Pick<
    typeof traceRepo,
    'getRecentTurns' | 'countTurnsSince' | 'createChatTurn' | 'createTrace' | 'updateTraceNarrative'
  >;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Run full test suite to check no regressions**

Run: `npx tsx --test tests/*.test.ts tests/db/*.test.ts tests/workflow/*.test.ts tests/contracts/*.test.ts tests/unit/*.test.ts`
Expected: All existing tests still PASS

- [ ] **Step 8: Commit**

```bash
git add src/mastra/workflows/execute-turn.ts \
        src/mastra/workflows/chat-turn.ts \
        tests/emotion-narrator.test.ts
git commit -m "feat: wire async narrative generation into executeTurn pipeline"
```

---

### Task 5: Trace API + Dashboard Display

**Files:**
- Modify: `src/app/api/traces/[id]/route.ts`
- Modify: `src/components/CoEExplanationCard.tsx`
- Modify: `src/app/(dashboard)/traces/[id]/page.tsx`

- [ ] **Step 1: Update trace API to return narrativeJson**

In `src/app/api/traces/[id]/route.ts`, the `traceRepo.getTraceById` now returns `narrativeJson`. The response already returns `{ trace }`, so `narrativeJson` will be included automatically in the JSON serialization.

No code change needed if `getTraceById` returns the extended type. Verify by reading the response shape.

- [ ] **Step 2: Update CoEExplanationCard to accept and render narrative**

Replace the full content of `src/components/CoEExplanationCard.tsx`:

```typescript
'use client';

import type { CoEExplanation } from '@/lib/rules/coe';
import type { EmotionNarrative } from '@/lib/schemas/narrative';
import { PAD_DELTA_NOTICE_THRESHOLD } from '@/lib/rules/pad';

type CoEExplanationCardProps = {
  coe: CoEExplanation;
  narrative?: EmotionNarrative | null;
  variant?: 'compact' | 'detailed';
  className?: string;
};

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function deltaTone(value: number): string {
  if (value > PAD_DELTA_NOTICE_THRESHOLD) return 'bg-emerald-100 text-emerald-700';
  if (value < -PAD_DELTA_NOTICE_THRESHOLD) return 'bg-rose-100 text-rose-700';
  return 'bg-gray-100 text-gray-600';
}

function NarrativeView({ narrative }: { narrative: EmotionNarrative }) {
  return (
    <>
      <div className="mt-2 rounded bg-white/70 px-2 py-2 text-[11px] text-gray-700">
        <p className="font-medium text-gray-800">感情変化</p>
        <p className="mt-1 leading-relaxed">{narrative.characterNarrative}</p>
      </div>
      <div className="mt-2 rounded bg-white/70 px-2 py-2 text-[11px] text-gray-700">
        <p className="font-medium text-gray-800">関係性への影響</p>
        <p className="mt-1 leading-relaxed">{narrative.relationshipNarrative}</p>
      </div>
      {narrative.drivers.length > 0 && (
        <div className="mt-2 rounded bg-white/70 px-2 py-2 text-[11px] text-gray-700">
          <p className="font-medium text-gray-800">主要ドライバー</p>
          <ul className="mt-1 space-y-1">
            {narrative.drivers.map((driver, index) => (
              <li key={`driver-${index}`}>・{driver}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function FallbackView({ coe, variant }: { coe: CoEExplanation; variant: 'compact' | 'detailed' }) {
  return (
    <>
      <p className="mt-1 text-xs leading-relaxed text-indigo-900">{coe.summary}</p>

      <div className="mt-2 rounded bg-white/70 px-2 py-2 text-[11px] text-gray-700">
        <p className="font-medium text-gray-800">
          感情名: {coe.beforeEmotionLabel} → {coe.afterEmotionLabel}
        </p>
        <p className="mt-1 text-gray-600">
          変化前: {coe.beforeEmotionDescription}
        </p>
        <p className="mt-0.5 text-gray-600">
          変化後: {coe.afterEmotionDescription}
        </p>
      </div>

      {coe.movementNarrative.length > 0 && (
        <div className="mt-2 rounded bg-white/70 px-2 py-2 text-[11px] text-gray-700">
          <p className="font-medium text-gray-800">どうして感情が動いたか</p>
          <ul className="mt-1 space-y-1">
            {coe.movementNarrative.map((line, index) => (
              <li key={`${line}-${index}`}>・{line}</li>
            ))}
          </ul>
        </div>
      )}

      {coe.policySummary && (
        <p className="mt-2 rounded bg-white/70 px-2 py-1 text-[11px] text-gray-700">
          応答方針: {coe.policySummary}
        </p>
      )}

      {variant === 'detailed' && coe.topDrivers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {coe.topDrivers.map((driver, index) => (
            <span key={`${driver.axis}-${driver.factorKey}-${index}`} className="rounded bg-white px-2 py-0.5 text-[10px] text-gray-700">
              {driver.axisShortLabel}・{driver.factorLabel} {formatSigned(driver.contribution)}
            </span>
          ))}
        </div>
      )}

      {variant === 'detailed' && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {coe.axisSummaries.map((axis) => (
            <div key={axis.axis} className="rounded border border-white bg-white p-2">
              <p className="text-[11px] font-semibold text-gray-700">
                {axis.axisShortLabel} ({axis.axisLabel})
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-gray-500">
                {axis.before.toFixed(2)} → {axis.after.toFixed(2)} ({formatSigned(axis.delta)})
              </p>
              <div className="mt-1.5 space-y-1">
                {axis.topDrivers.map((driver, index) => (
                  <p key={`${axis.axis}-${driver.factorKey}-${index}`} className="text-[10px] text-gray-600">
                    {driver.factorLabel}: {formatSigned(driver.contribution)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function CoEExplanationCard({
  coe,
  narrative,
  variant = 'compact',
  className = '',
}: CoEExplanationCardProps) {
  return (
    <div className={`rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-indigo-700">PAD 感情変化の説明</p>
        <div className="flex gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${deltaTone(coe.delta.pleasure)}`}
          >
            P {formatSigned(coe.delta.pleasure)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${deltaTone(coe.delta.arousal)}`}
          >
            A {formatSigned(coe.delta.arousal)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${deltaTone(coe.delta.dominance)}`}
          >
            D {formatSigned(coe.delta.dominance)}
          </span>
        </div>
      </div>

      {narrative ? (
        <NarrativeView narrative={narrative} />
      ) : (
        <FallbackView coe={coe} variant={variant} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update trace viewer page to pass narrative**

In `src/app/(dashboard)/traces/[id]/page.tsx`:

Add `narrativeJson` to the `TurnTrace` interface:

```typescript
  narrativeJson?: {
    characterNarrative: string;
    relationshipNarrative: string;
    drivers: string[];
  } | null;
```

Find the line where `<CoEExplanationCard coe={coe} variant="detailed" />` is rendered and change it to:

```typescript
<CoEExplanationCard coe={coe} narrative={trace.narrativeJson ?? null} variant="detailed" />
```

- [ ] **Step 4: Run build check**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/traces/[id]/route.ts \
        src/components/CoEExplanationCard.tsx \
        src/app/(dashboard)/traces/[id]/page.tsx
git commit -m "feat: display LLM narrative in trace viewer with template fallback"
```

---

### Task 6: Final Integration Verification

**Files:**
- Modify: `tests/emotion-narrator.test.ts`

- [ ] **Step 1: Add a contract test for narrative_json column in DDL**

Append to `tests/emotion-narrator.test.ts`:

```typescript
test('narrative_json column exists and defaults to NULL', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-narrator-col-'));
  const dbPath = path.join(tempDir, 'col-test.db');
  const prevDb = process.env.DATABASE_URL;
  const prevLocal = process.env.LOCAL_DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

  try {
    const db = getDb();
    await db.execute(TRACE_TABLE_DDL);

    const result = await db.execute(`PRAGMA table_info(turn_traces)`);
    const narrativeCol = result.rows.find((r) => r.name === 'narrative_json');
    assert.ok(narrativeCol, 'narrative_json column should exist');
    assert.equal(narrativeCol.dflt_value, 'NULL');
  } finally {
    process.env.DATABASE_URL = prevDb;
    process.env.LOCAL_DATABASE_URL = prevLocal;
    await getDb().close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run all narrator tests**

Run: `npx tsx --test tests/emotion-narrator.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite**

Run: `npx tsx --test tests/*.test.ts tests/db/*.test.ts tests/workflow/*.test.ts tests/contracts/*.test.ts tests/unit/*.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/emotion-narrator.test.ts
git commit -m "test: add contract test for narrative_json column"
```
