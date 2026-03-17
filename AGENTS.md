# AGENTS.md

This file tells coding agents and human contributors how to work in this repository.

## Mission

Build a **single-character MVP** for Yumekano using **Next.js + Mastra + TypeScript**.

The repo must support two surfaces:

1. the in-game runtime conversation agent
2. the internal dashboard used by character designers to tune, test, and publish behavior

## Product constraints that are already decided

- MVP is for **one character only**
- any dashboard operator can **publish directly**
- phase progression is **free-form per character**
- long-term memory should persist **indefinitely** unless explicitly deleted
- game/backend integration is **not fixed yet**
- provider choice must remain **replaceable**
- default provider family is **xAI Grok**, but no domain logic may depend on xAI-specific request/response formats

## Non-negotiable engineering rules

### 1. Keep behavior data-driven
Do not hardcode character-specific behavior in route handlers or React components.

Character differences must live in versioned data:
- character config
- phase graph
- prompt bundle
- authored examples
- tuning parameters

### 2. Separate planning from generation
Never let the surface generator both decide intent and write the final message in one opaque step.

The minimum turn pipeline is:
1. state update
2. memory retrieval
3. planning
4. candidate generation
5. ranking / guards
6. memory writeback

### 3. Everything crossing step boundaries must be typed
Use Zod schemas for:
- workflow step IO
- stored configs
- designer-authored JSON
- release artifacts
- eval case definitions

### 4. Long-term memory must be append-first
Never keep only a mutable summary blob.

Required memory primitives:
- raw turn/event log
- structured working memory
- episodic events
- graph facts
- reflective observations
- supersession / contradiction links
- quality labels where applicable

### 5. Do not overfit to prompts
The repo should still behave sanely if prompt text is slightly rewritten.
Important product logic belongs in:
- state transitions
- retrieval rules
- scorers
- rank weights
- authored config
- hard constraints

### 6. Preserve autonomy
The character must not default to agreement or compliance.
Always preserve the possibility of:
- disagreement
- delay
- redirect
- repair
- refusal
- mood-based non-availability

### 7. Version all publishable surfaces
Never mutate a published artifact in place.

At minimum version:
- character versions
- prompt bundle versions
- phase graph versions
- scenario set versions
- release records

### 8. Make traces first-class
Every turn must be reconstructable.
A turn trace must show:
- character version
- prompt bundle version
- model id
- active phase
- emotion state before/after
- retrieved memory ids
- planner output
- candidates + scores
- chosen response
- memory writes

## Tech defaults

- TypeScript with `strict: true`
- Next.js App Router
- Mastra for agents / workflows / memory / evals / tracing
- libSQL/Turso-compatible persistence in MVP
- AI SDK transport for streaming UI
- server-first architecture; keep client components thin

## Repo organization expectations

See `REPO_STRUCTURE.md` for the canonical layout.
Important rule: domain logic must live outside UI components.

## Workflow expectations

Use Mastra workflows for:
- `chat_turn`
- `session_consolidation`
- `eval_run`
- `publish_release`
- future human-in-the-loop pause/resume if needed

Do not hand-roll state machines in random services when workflow steps can express the same thing more clearly.

## Dashboard expectations

The primary authoring surface is **structured UI**, not raw prompts.

Raw prompt editing should exist, but as an advanced panel.

Designers should be able to answer:
- why did she say this?
- what memory was used?
- why didn’t the phase advance?
- why did she refuse?
- why did this candidate lose?

## Testing rules

Every material change to behavior requires at least one of:
- a new scenario
- a scorer adjustment
- a regression case
- a trace snapshot update

Test the structure, not only the final sentence.

Good tests include:
- phase gate logic
- memory supersession
- emotion carryover
- ranker tie-break behavior
- release rollback
- config validation failures

## What not to do

- do not bury phase logic inside prose prompts
- do not let generator update durable memory directly
- do not store only a giant transcript string
- do not add approval workflow; direct publish is intentional for MVP
- do not assume a fixed global phase count
- do not assume game integration tables already exist

## Definition of done

A feature is not done unless:
1. schemas exist,
2. storage path is defined,
3. trace output is inspectable,
4. at least one test or eval case covers it,
5. dashboard surface exists if the feature is designer-visible.
