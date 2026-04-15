# Emotion Narrative: LLM-Generated Async Emotion Logs

## Problem

The current emotion log per chat turn is constructed from hardcoded template strings mapped to PAD coordinates and appraisal thresholds. This produces formulaic, repetitive text that conveys little meaning to designers inspecting traces. The underlying CoE pipeline extracts rich contextual information (interaction acts, evidence spans from actual user text, 10-dimensional relational appraisal), but `buildCoEExplanation` discards all of this and maps to ~15 fixed phrases.

## Solution

Add an async LLM-based narrative generator that runs **after** the chat response is returned. It takes the rich extraction data already available in `executeTurn` and produces a natural-language, context-aware emotion summary. The narrative is written back to the trace record and displayed in the dashboard instead of the formulaic text.

## Design Decisions

- **Perspective**: Third-person objective (not character first-person)
- **Async / non-blocking**: Chat response latency is unaffected; narrative generation is fire-and-forget after trace persistence
- **Fallback**: If narrative is not yet generated (NULL), the existing `buildCoEExplanation` output is shown as-is
- **No deletion of existing code**: `buildCoEExplanation` remains as the fallback path

## Architecture

```
executeTurn flow (unchanged):
  CoE extraction → appraisal → integration → planning → generation → ranking
  → persistTrace(trace)         [sync]
  → updatePairState(...)        [sync]
  → return { text, traceId, emotion, coe }   ← response sent immediately

Post-response async flow (new):
  → runEmotionNarrator(narratorInput)         [fire-and-forget]
  → UPDATE turn_traces SET narrative_json = ? WHERE id = ?
```

### Sequence

1. `executeTurn` completes and returns `text` + `traceId` to the API route
2. API route sends the HTTP response immediately
3. In parallel (non-blocking), `generateNarrativeAsync` is triggered with the trace data
4. `runEmotionNarrator` calls the LLM with extraction context
5. The result is written to `turn_traces.narrative_json`
6. When a designer opens the trace page, `narrative_json` is read; if present, it replaces the formulaic display

## Components

### 1. `runEmotionNarrator` agent

**Location**: `src/mastra/agents/emotion-narrator.ts`

**Model**: `analysisMedium` (same tier as CoE evidence extractor)

**Input**:
```typescript
type EmotionNarratorInput = {
  userMessage: string;
  assistantMessage: string;
  interactionActs: CoEEvidenceExtractorResult['interactionActs'];
  relationalAppraisal: CoEEvidenceExtractorResult['relationalAppraisal'];
  emotionBefore: PADState;
  emotionAfter: PADState;
  relationshipBefore: RelationshipMetrics;
  relationshipAfter: RelationshipMetrics;
  characterName: string;
  currentPhaseId: string;
};
```

**Output**:
```typescript
type EmotionNarrative = {
  characterNarrative: string;   // 1-3 sentences: how the character's emotional state shifted
  relationshipNarrative: string; // 1 sentence: impact on the relationship
  drivers: string[];             // 1-3 items: key emotion drivers in natural language
};
```

**Output example** (third-person objective):
```json
{
  "characterNarrative": "ユーザーの「一緒にいたい」という素直な表現を受けて、快感情が上昇し心理的な温かさが増した。一方で急な距離の詰め方に覚醒が高まり、軽い緊張も生じている。",
  "relationshipNarrative": "信頼が微増し、親密さへの準備度が一歩前進した。",
  "drivers": [
    "素直な愛情表現（affection） → 快感情 +0.23",
    "急な距離感の変化（intimacy_bid） → 覚醒 +0.15",
    "相互性の確認（reciprocity） → 信頼 +2.1"
  ]
}
```

**Prompt strategy**:
- System prompt: "You are an emotion analysis reporter. Given the extraction evidence and PAD state changes, write a concise third-person objective summary."
- Provide the actual user text, extracted interaction acts with evidence spans, appraisal values, and before/after states
- Instruct to reference specific words/phrases from the user message when explaining drivers
- Output as structured JSON via Zod schema validation

### 2. DB migration

**File**: `supabase/migrations/YYYYMMDDNNNNNN_add_narrative_json.sql`

```sql
ALTER TABLE turn_traces ADD COLUMN narrative_json TEXT DEFAULT NULL;
```

- `NULL` means narrative not yet generated (in-flight or skipped)
- Column is TEXT storing JSON (consistent with other `*_json` columns in the table)

### 3. Async trigger in `executeTurn`

**Location**: `src/mastra/workflows/execute-turn.ts`, after `persistTrace` call

```typescript
// Fire-and-forget: do not await
generateNarrativeAsync({
  traceId,
  input: { /* narratorInput built from existing variables */ },
  persistence: input.persistence,
}).catch((err) => console.error('Narrative generation failed:', err));
```

**`generateNarrativeAsync` function**:
- Calls `runEmotionNarrator`
- On success: calls `persistence.updateTraceNarrative(traceId, narrative)`
- On failure: logs error, leaves `narrative_json` as NULL (fallback works)

### 4. Repository layer

**File**: `src/lib/repositories/trace-repo.ts`

Add method:
```typescript
async updateTraceNarrative(traceId: string, narrative: EmotionNarrative): Promise<void>
```

This executes:
```sql
UPDATE turn_traces SET narrative_json = ? WHERE id = ?
```

### 5. Persistence interface update

**File**: `src/mastra/workflows/execute-turn.ts`

Add to the `persistence` interface:
```typescript
updateTraceNarrative?: (traceId: string, narrative: EmotionNarrative) => Promise<void>;
```

Optional so existing callers (tests, draft-chat) are unaffected.

### 6. Display changes

**File**: `src/components/CoEExplanationCard.tsx`

Update the component to accept an optional `narrative` prop:
```typescript
type Props = {
  coe: CoEExplanation;
  narrative?: EmotionNarrative | null;
  variant?: 'compact' | 'detailed';
};
```

Rendering logic:
- If `narrative` is present: render `characterNarrative`, `relationshipNarrative`, and `drivers` list
- If `narrative` is null/undefined: render existing `coe.summary`, `movementNarrative`, etc. (unchanged)

**File**: `src/app/(dashboard)/traces/[id]/page.tsx`

- Read `narrative_json` from the trace data
- Pass parsed value to `CoEExplanationCard` as `narrative` prop

### 7. Schema

**File**: `src/lib/schemas/trace.ts` (or new file `src/lib/schemas/narrative.ts`)

```typescript
export const EmotionNarrativeSchema = z.object({
  characterNarrative: z.string(),
  relationshipNarrative: z.string(),
  drivers: z.array(z.string()).min(1).max(3),
});

export type EmotionNarrative = z.infer<typeof EmotionNarrativeSchema>;
```

## Scope boundaries

**In scope**:
- New `runEmotionNarrator` agent
- DB migration for `narrative_json`
- Async trigger after trace persistence
- `trace-repo.updateTraceNarrative`
- `CoEExplanationCard` conditional rendering
- Trace page reading and passing narrative
- Zod schema for narrative output

**Out of scope**:
- Changing the chat API response format (still returns existing `coe` field)
- Removing `buildCoEExplanation` or related template code
- Streaming or real-time narrative updates in the UI
- Narrative generation for draft-chat (can be added later)
- Backfilling narratives for existing traces

## Testing strategy

- Unit test: `runEmotionNarrator` returns valid `EmotionNarrative` schema
- Unit test: `generateNarrativeAsync` error does not propagate (fire-and-forget safety)
- Integration test: After `runChatTurn`, `narrative_json` is eventually non-null in the trace
- Component test: `CoEExplanationCard` renders narrative when present, falls back when null
- Contract test: `EmotionNarrativeSchema` validates expected shape
