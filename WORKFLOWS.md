# Workflows

## 1. `chat_turn`

The core runtime workflow.
`chat_turn`, `draft_chat_turn`, and `run_eval_suite` now share the same internal `executeTurn()` path and only swap context loading / persistence adapters.

### Input
```ts
{
  userId: string
  characterId: string
  threadId: string
  message: string
  releaseChannel?: "prod"
}
```

### Steps

#### 1. `load_context`
Loads:
- published character version
- prompt bundle
- pair state
- recent messages
- current working memory

#### 2. `retrieve_memory`
Returns:
- mandatory open threads
- relevant graph facts
- relevant episodic events
- relevant observation blocks

#### 3. `compute_appraisal`
Builds the appraisal vector from message + memory + state.

#### 4. `update_emotion`
Updates fast affect and slow mood, then persists `fast / slow / combined` PAD layers.

#### 5. `plan_turn`
Calls planner agent with structured output.

#### 6. `evaluate_phase_transition`
Applies deterministic phase-edge checks against planner proposal.

#### 7. `generate_candidates`
Generates 3–5 reply candidates.

#### 8. `rank_candidates`
Runs deterministic guard checks first, then scorer aggregation, then an LLM judge, then deterministic fallback/tie-break.

#### 9. `persist_turn`
Writes:
- turn log
- trace
- working memory patch
- episodic events
- graph facts
- open thread changes
- sourceTurn-linked memory writes with threshold decisions

#### 10. `schedule_consolidation_if_needed`
Triggers background consolidation if thresholds are met.

### Output
```ts
{
  text: string
  traceId: string
  phaseId: string
  emotion: {
    pleasure: number
    arousal: number
    dominance: number
  }
}
```

---

## 2. `consolidate_memory`

### Trigger
- threshold crossed
- session end
- manual dashboard action
- scheduled maintenance run

### Input
```ts
{
  pairId?: string
  scopeId?: string
  mode: "light" | "deep"
}
```

### Steps
1. load recent raw turns and new episodic events
2. merge duplicates
3. create / update observation blocks
4. resolve or refresh open threads
5. attach or update quality labels

### Why
This keeps indefinite retention without stuffing the live prompt.

---

## 3. `run_eval_suite`

Uses the same `executeTurn()` engine as production, but injects the requested character version / phase graph / prompt bundle instead of the current live release.

---

## 4. `run_model_matrix`

Runs `run_eval_suite` repeatedly with different logical model-role overrides after logic changes are complete.

### Input
```ts
{
  characterVersionId: string
  scenarioSetId: string
}
```

### Steps
1. materialize scenario cases
2. run each case in isolated sandbox threads
3. score outputs
4. aggregate results
5. persist eval run + case traces

---

## 4. `publish_release`

Because MVP allows direct publish, the publish workflow must be safe and simple.

### Input
```ts
{
  characterVersionId: string
  promptBundleVersionId: string
  publishedBy: string
}
```

### Steps
1. validate immutable artifact references
2. create release record
3. switch live pointer for the character
4. emit audit event

### Output
```ts
{
  releaseId: string
  status: "published"
}
```

---

## 5. `rollback_release`

### Input
```ts
{
  targetReleaseId: string
  rolledBackBy: string
}
```

### Steps
1. locate previous valid release
2. create rollback release record
3. repoint live version
4. emit audit event

---

## 6. Optional future: pause/resume workflow

Mastra supports workflow suspension and resumption with persisted snapshots.
Useful future uses:
- human override before a risky publish
- async provider failover
- large consolidation jobs
- manual memory review queues

Not required in MVP.
