# Architecture

## 1. High-level shape

```text
Next.js App Router
├─ app/api/chat
│  └─ invokes Mastra workflow: chat_turn
├─ app/(dashboard)
│  ├─ characters
│  ├─ playground
│  ├─ evals
│  ├─ traces
│  └─ releases
├─ src/mastra
│  ├─ workflows
│  ├─ agents
│  ├─ memory
│  ├─ scorers
│  └─ providers
└─ src/lib
   ├─ repositories
   ├─ versioning
   ├─ rules
   └─ integration
```

## 2. Core architecture decisions

### 2.1 One canonical thread per user×character pair
Mastra’s observational memory works best in thread scope, while resource scope is documented as experimental.
For MVP, the cleanest design is:
- one **thread** per user×character pair in production chat
- dashboard test runs use separate sandbox threads
- durable pair memory also exists in custom tables outside raw thread history

This avoids cross-thread continuity bugs while keeping long-horizon state.

### 2.2 Hybrid memory, not just built-in memory
Use Mastra memory primitives where they fit, but keep Yumekano-specific durable memory layers explicit.

Use Mastra for:
- message history
- working memory
- semantic recall
- workflow snapshots
- traces / eval storage

Add custom layers for:
- episodic event ledger
- graph facts with supersession
- open threads
- reflective observation blocks with quality labels

### 2.3 Planning-first runtime
The surface line is the end of the pipeline, not the whole pipeline.

---

## 3. chat_turn workflow

## Step A — Load runtime context
Inputs:
- userId
- characterId
- pairThreadId
- current message
- optional release channel

Load:
- published character version
- prompt bundle version
- pair state
- recent messages
- current working memory

## Step B — Retrieve memory
Retrieve in this order:

1. active open threads
2. explicitly referenced recent episodes
3. graph facts matching current entities/topics
4. semantic recall over episodic events / observations
5. compact recent dialogue window

Then apply a budgeter:
- always keep open threads
- prefer recent contradictory or superseding items
- prefer memories with high salience and high recency-weighted relevance
- drop low-quality memories first

## Step C — Update appraisals
Compute appraisal features from:
- user message
- recent dialogue
- unresolved threads
- retrieved memory
- current pair state

Recommended appraisal vector:
- goal_congruence
- controllability
- certainty
- norm_alignment
- attachment_security
- reciprocity
- pressure_intrusiveness
- novelty
- self_relevance

These are not directly shown to designers in full.
They are internal features.

## Step D — Update PAD
Maintain two timescales:

### Fast affect
Short-lived turn reaction:
- fast_pleasure
- fast_arousal
- fast_dominance

### Slow mood
Smoothed carry-over state:
- mood_pleasure
- mood_arousal
- mood_dominance

Update rule:
- fast state reacts strongly to this turn
- slow state partially absorbs fast state and decays gradually
- unresolved threads bias recovery and baseline

Why this shape:
- appraisal models are better for causal interpretation
- continuous PAD is better for carry-over and designer controls
- recent work on affect flow and emotional coherence supports modeling changes across turns rather than isolated labels

## Step E — Planner
Planner outputs typed `TurnPlan`:
- stance
- dialogue acts
- memory focus
- phase transition proposal
- intimacy decision
- emotion delta intent
- must-avoid list

Planner must reason in **third-person**:
> what would this character actually do now?

This is both a realism choice and an anti-sycophancy defense.

## Step F — Candidate generation
Generate 3–5 candidate replies from the same plan.
Vary:
- phrasing
- initiative
- softness/directness
- memory explicitness

Do not vary:
- phase compliance
- intimacy decision
- hard constraints

## Step G — Ranking
Score candidates on:
- persona consistency
- phase compliance
- memory grounding
- emotional coherence
- autonomy
- naturalness
- provider-compatibility / safety floor

Use a mixed ranker:
- deterministic hard rejects first
- model-based scorer second
- deterministic tie-breaks last

## Step H — Writeback
After final selection:
- append raw turn
- update working memory patch
- write episodic events
- write graph facts
- update open threads
- schedule/refire consolidation if needed

## Step I — Trace
Store full trace artifact for dashboard inspection.

---

## 4. Long-term memory design

## 4.1 Memory layers

### A. Working memory
Small always-available structured JSON.
Use Mastra schema-based working memory for pair-level state that must be cheap to inject every turn.

Suggested working-memory fields:
- preferred address form
- known likes/dislikes
- current cooldowns
- active unresolved tension summary
- current relationship stance
- known hard corrections
- intimacy context hints

### B. Episodic events
Append-only events for important moments.

Fields:
- event_id
- type
- timestamp
- summary
- salience
- retrieval_keys
- participants
- emotion_signature
- supersedes_event_id
- quality_score
- source_turn_ids

### C. Graph facts
Stable relational facts.
Examples:
- user likes X
- character promised Y
- last conflict topic = Z

Every fact can be:
- active
- superseded
- disputed

### D. Observation blocks
Reflective, dense summaries over spans of interaction.
These should summarize **patterns**, not replay transcripts.

### E. Open threads
Unresolved issues that must influence future turns:
- jealousy incident
- broken promise
- not yet answered invitation
- recent argument
- trust repair in progress

## 4.2 Retrieval strategy

Do not query one vector index and stop.

Use a staged retrieval plan:

1. **mandatory retrieval**
   - active open threads
   - most recent supersessions / corrections
2. **symbolic retrieval**
   - graph facts by entity / predicate match
3. **semantic retrieval**
   - episodic events and observations by embedding search
4. **temporal reranking**
   - recency decay
   - recency boosts for unresolved items
5. **quality reranking**
   - down-rank memories linked to later failed evals or corrected states

This is informed by recent findings that long-term memory quality depends on extraction, updates, temporal reasoning, and experience quality—not only embedding recall.

## 4.3 Memory quality labels
Each durable memory item may carry:
- confidence
- quality_score
- last_used_at
- was_helpful flag
- linked_eval_failures

Reason:
research on experience-following behavior shows poor stored experiences can propagate errors.
If a memory repeatedly correlates with bad outputs, it should be down-ranked or reviewed.

## 4.4 Consolidation schedule

### Turn-time
Run a lightweight extractor every turn.

### Session-end / threshold-based
Run a consolidation workflow when:
- token thresholds are crossed
- enough new events accumulate
- a session ends
- a high-salience conflict or milestone occurs

### Periodic background
Run deeper reflection later:
- merge duplicates
- update trend summaries
- compress stale observations
- assign or revise quality labels

Mastra workflows support suspend/resume and persisted snapshots, which is useful for background or human-intervened flows.

---

## 5. Emotion architecture

## 5.1 Why not pure PAD
Pure PAD is compact, but too thin as the only decision layer.
It does not explain *why* the character became more dominant or less warm.

## 5.2 Why not pure Chain-of-Emotion
Pure chain prompting is useful, but too prompt-dependent if it is the only mechanism.

## 5.3 Hybrid chosen here
Use:

1. **appraisal feature extraction**
2. **state transition into PAD**
3. **designer-facing interpretable labels**
4. **planner constraints derived from state**

This lets you:
- explain behavior
- tune recovery speed
- persist mood
- keep UI understandable

## 5.4 Example influence rules
- high pressure_intrusiveness + unresolved conflict → lower willingness
- low attachment_security → less initiative
- high reciprocity + positive recency → more warmth
- high novelty + positive goal congruence → higher arousal

---

## 6. Provider architecture

## 6.1 Registry
Create a provider/model registry with logical roles:

- `conversationHigh`
- `analysisMedium`
- `embeddingDefault`

Default mapping in MVP:
- `conversationHigh` → xAI Grok family
- `analysisMedium` → initially same family unless cost data suggests otherwise
- `embeddingDefault` → whichever provider best matches chosen vector path

Do not hardcode model IDs across business logic.

## 6.2 Why xAI Grok is provisional default
xAI officially provides structured outputs, tool calling, and large context windows.
It also states API inputs/outputs are not used for training without explicit permission, but retains them for 30 days for abuse/misuse auditing.
That is acceptable as a provisional choice only if documented clearly and kept swappable.

## 6.3 Reasoning-model implications
Because Grok 4 is a reasoning model and does not support some generation penalties, style control should come from:
- character config
- planner intent
- prompt bundles
- ranker
not from token penalties.

---

## 7. Dashboard architecture

The dashboard is a normal Next.js surface backed by repository services.

### Pages
- `/characters/[id]`
- `/characters/[id]/phases`
- `/playground`
- `/evals`
- `/traces/[turnId]`
- `/releases`

### Authoring pattern
- draft version editing
- explicit publish action
- immutable published artifacts
- rollback by pointer switch, not destructive edits

---

## 8. Future integration adapter

Because game integration is undecided, define interfaces now:

```ts
interface GameContextAdapter {
  getUserIdentity(): Promise<{ userId: string }>
  getPairContext(input: { userId: string; characterId: string }): Promise<{
    currency?: number
    inventory?: string[]
    eventFlags?: Record<string, boolean>
    relationshipOverrides?: Record<string, unknown>
  }>
  recordTurnResult(input: {
    userId: string
    characterId: string
    turnId: string
    phaseId: string
    stateDelta: Record<string, unknown>
  }): Promise<void>
}
```

Implement an in-memory / local adapter first.
Real backend wiring comes later.
