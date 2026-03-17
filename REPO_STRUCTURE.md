# Repo Structure

## Recommended layout

```text
.
├─ src/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ chat/route.ts
│  │  │  ├─ evals/route.ts
│  │  │  ├─ releases/route.ts
│  │  │  └─ traces/[id]/route.ts
│  │  ├─ (dashboard)/
│  │  │  ├─ characters/
│  │  │  │  ├─ [id]/page.tsx
│  │  │  │  ├─ [id]/phases/page.tsx
│  │  │  │  └─ [id]/memory/page.tsx
│  │  │  ├─ playground/page.tsx
│  │  │  ├─ evals/page.tsx
│  │  │  ├─ traces/[id]/page.tsx
│  │  │  └─ releases/page.tsx
│  │  └─ layout.tsx
│  ├─ mastra/
│  │  ├─ index.ts
│  │  ├─ providers/
│  │  │  ├─ registry.ts
│  │  │  └─ model-roles.ts
│  │  ├─ workflows/
│  │  │  ├─ chat-turn.ts
│  │  │  ├─ consolidate-memory.ts
│  │  │  ├─ run-eval-suite.ts
│  │  │  └─ publish-release.ts
│  │  ├─ agents/
│  │  │  ├─ planner.ts
│  │  │  ├─ generator.ts
│  │  │  ├─ ranker.ts
│  │  │  ├─ memory-extractor.ts
│  │  │  └─ reflector.ts
│  │  ├─ memory/
│  │  │  ├─ working-memory.ts
│  │  │  ├─ retrieval.ts
│  │  │  ├─ consolidation.ts
│  │  │  └─ quality-labels.ts
│  │  ├─ scorers/
│  │  │  ├─ persona-consistency.ts
│  │  │  ├─ phase-compliance.ts
│  │  │  ├─ memory-grounding.ts
│  │  │  ├─ emotional-coherence.ts
│  │  │  ├─ autonomy.ts
│  │  │  └─ refusal-naturalness.ts
│  │  └─ prompts/
│  │     └─ loaded-from-db-or-files.ts
│  ├─ lib/
│  │  ├─ db/
│  │  │  ├─ client.ts
│  │  │  ├─ migrations/
│  │  │  └─ queries/
│  │  ├─ repositories/
│  │  │  ├─ character-repo.ts
│  │  │  ├─ pair-repo.ts
│  │  │  ├─ memory-repo.ts
│  │  │  ├─ eval-repo.ts
│  │  │  └─ release-repo.ts
│  │  ├─ schemas/
│  │  │  ├─ character.ts
│  │  │  ├─ phase.ts
│  │  │  ├─ prompts.ts
│  │  │  ├─ memory.ts
│  │  │  ├─ plan.ts
│  │  │  └─ trace.ts
│  │  ├─ rules/
│  │  │  ├─ phase-engine.ts
│  │  │  ├─ appraisal.ts
│  │  │  ├─ pad.ts
│  │  │  └─ rank-weights.ts
│  │  ├─ versioning/
│  │  │  ├─ drafts.ts
│  │  │  ├─ publish.ts
│  │  │  └─ rollback.ts
│  │  └─ integration/
│  │     ├─ game-context-adapter.ts
│  │     └─ local-dev-adapter.ts
│  ├─ components/
│  │  ├─ dashboard/
│  │  ├─ graphs/
│  │  ├─ editors/
│  │  └─ traces/
│  └─ styles/
├─ tests/
│  ├─ fixtures/
│  ├─ unit/
│  ├─ integration/
│  └─ evals/
├─ docs/
│  └─ optional extracted copies of the spec
└─ AGENTS.md
```

## Notes

### Keep schemas near the domain
All Zod schemas should live in `src/lib/schemas/`.
Do not redefine ad-hoc shapes in route files.

### Dashboard reads from repositories, not raw SQL
Routes and server actions should call domain services or repositories.

### Prompt sources
Prompt bundles can begin as markdown files plus DB-backed versions later.
Keep the loader abstraction so the runtime does not care where prompts are stored.

### Tests
- unit: deterministic rules
- integration: workflow runs
- evals: scenario datasets and scorer runs

## Minimal first PR
If Codex is building this incrementally, the first useful slice is:

```text
src/app/api/chat/route.ts
src/mastra/index.ts
src/mastra/workflows/chat-turn.ts
src/mastra/agents/planner.ts
src/mastra/agents/generator.ts
src/mastra/agents/ranker.ts
src/lib/schemas/*
src/lib/repositories/*
src/app/(dashboard)/playground/page.tsx
```
