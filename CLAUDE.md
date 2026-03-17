# Yumekano Agent - Project Instructions

## Mission

Build a **single-character MVP** for Yumekano using **Next.js + Mastra + TypeScript**.

Two surfaces to support:
1. **In-game runtime** - conversation agent
2. **Internal dashboard** - for character designers to tune, test, and publish behavior

## Product Constraints (Already Decided)

- MVP is for **one character only**
- Dashboard operator can **publish directly** (no approval workflow)
- Phase progression is **free-form per character**
- Long-term memory persists **indefinitely** unless explicitly deleted
- Game/backend integration is **not fixed yet**
- Provider choice must remain **replaceable** (default: xAI Grok, but no xAI-specific dependencies)

## Non-Negotiable Engineering Rules

### 1. Keep behavior data-driven
Character differences must live in versioned data (config, phase graph, prompt bundle, examples, tuning params).
Do not hardcode character-specific behavior in route handlers or components.

### 2. Separate planning from generation
Minimum turn pipeline:
1. state update
2. memory retrieval
3. planning
4. candidate generation
5. ranking / guards
6. memory writeback

### 3. Everything crossing step boundaries must be typed
Use Zod schemas for: workflow step IO, stored configs, designer-authored JSON, release artifacts, eval cases.

### 4. Long-term memory must be append-first
Required memory primitives:
- raw turn/event log
- structured working memory
- episodic events
- graph facts
- reflective observations
- supersession / contradiction links
- quality labels

### 5. Do not overfit to prompts
Important logic belongs in: state transitions, retrieval rules, scorers, rank weights, config, hard constraints.

### 6. Preserve autonomy
The character must not default to agreement. Always preserve possibility of: disagreement, delay, redirect, repair, refusal, mood-based non-availability.

### 7. Version all publishable surfaces
Never mutate published artifacts. Version: character, prompt bundle, phase graph, scenario set, release records.

### 8. Make traces first-class
Every turn must be reconstructable. Trace must show: versions, model id, phase, emotion before/after, retrieved memory ids, planner output, candidates + scores, chosen response, memory writes.

## Tech Stack

- TypeScript with `strict: true`
- Next.js App Router
- Mastra for agents / workflows / memory / evals / tracing
- libSQL/Turso-compatible persistence
- AI SDK transport for streaming UI
- Server-first architecture; keep client components thin

## Implementation Priority

1. Build repo structure per `REPO_STRUCTURE.md`
2. Implement schemas from `CHARACTER_CONFIG_SPEC.md` and `DATA_MODEL.md`
3. Implement `chat_turn` workflow from `WORKFLOWS.md`
4. Build minimal read-only dashboard
5. Add editing, evals, and release actions

### First Milestone
A designer can:
- Open one character
- Edit a draft
- Run a sandbox chat
- Inspect phase / memory / trace
- Publish a version
- Roll back

## What NOT to Do

- Do not bury phase logic inside prose prompts
- Do not let generator update durable memory directly
- Do not store only a giant transcript string
- Do not add approval workflow (direct publish is intentional)
- Do not assume a fixed global phase count
- Do not assume game integration tables already exist
- Do not invent extra product requirements
- Do not hardcode character personality in code branches

## Definition of Done

A feature is not done unless:
1. Schemas exist
2. Storage path is defined
3. Trace output is inspectable
4. At least one test or eval case covers it
5. Dashboard surface exists if designer-visible

## Reference Documents

All detailed specs are in `yumekano-codex-spec-v2/`:

| File | Content |
|------|---------|
| `PRD.md` | Product requirements document |
| `ARCHITECTURE.md` | System architecture details |
| `DATA_MODEL.md` | Data schemas and relationships |
| `CHARACTER_CONFIG_SPEC.md` | Character configuration schema |
| `WORKFLOWS.md` | Mastra workflow definitions |
| `REPO_STRUCTURE.md` | Directory layout |
| `SCREENS.md` | Dashboard screen specs |
| `EVALS.md` | Evaluation framework |
| `APP_OVERVIEW.md` | Application overview |
| `OPEN_QUESTIONS.md` | Unresolved design questions |
| `prompts/` | Prompt templates |

## Testing Rules

Every behavior change requires at least one of:
- A new scenario
- A scorer adjustment
- A regression case
- A trace snapshot update

Test the structure, not only the final sentence.
