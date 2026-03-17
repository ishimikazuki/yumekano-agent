# Yumekano Agent + Designer Dashboard — App Overview

## What this is

This repository defines a **Mastra + Next.js** system with two connected products:

1. **Runtime conversation agent** for one Yumekano character in MVP
2. **Internal designer dashboard** for non-engineer character designers to tune, test, compare, and publish behavior changes

The system is for a **single character first**. That is deliberate. The goal is not breadth; it is to prove that one character can sustain a believable long-running relationship with stable memory, phase progression, emotional carryover, and post-completion autonomy.

## Primary user

The main dashboard user is a **character designer**.

They are responsible for:
- defining how the character speaks
- tuning how she warms up, resists, cools off, forgives, remembers, and initiates
- authoring phase nodes and transition conditions
- testing and publishing changes

They are **not** expected to edit code.

## Product thesis

The character should not feel like a compliant text generator.
She should feel like a person with:
- an authored personality
- a changing emotional state
- persistent relationship memory
- explicit relationship phases
- autonomy after the authored phase graph completes

The dashboard therefore must expose **typed controls and traces**, not just a big prompt text area.

## MVP decisions locked in

- **Stack**: TypeScript, Next.js App Router, Mastra
- **Scope**: 1 character only
- **Publishing**: any dashboard operator can publish directly
- **Phase structure**: free-form per character, not a global fixed schema
- **Memory retention target**: effectively indefinite until explicit deletion
- **Infra**: cheapest-fastest first; storage/provider must remain replaceable
- **Game integration**: TBD, so the repo will define adapters and contracts rather than binding to a specific game backend now
- **Provider default**: xAI Grok family, abstracted behind a provider registry

## Core design principles

### 1. Typed state beats giant prompts
Character behavior should come primarily from typed config, state, memory retrieval, and scoring.
Prompts stay modular and relatively short.

### 2. Memory is event-sourced
Do not treat memory as one mutable blob.
Store durable events, facts, observations, open threads, and supersession edges.

### 3. Planning is separate from surface text
Each turn should decide **what the character wants to do** before writing **how she says it**.

### 4. Long-term memory is selective, not transcript replay
The system keeps durable memory indefinitely, but only retrieves what matters for the current turn.

### 5. Evaluation is part of authoring
A behavior change is incomplete until the designer can inspect the trace and compare it against scenario tests.

### 6. Autonomy is required
Even after the phase graph is completed, the character is not a yes-machine.
Mood, conflict, context, and authored personality still govern whether she engages, delays, redirects, or refuses.

## Runtime shape

```text
Next.js app
├─ app/api/chat
│  └─ starts Mastra workflow: chat_turn
├─ src/mastra
│  ├─ workflows/chat-turn.ts
│  ├─ workflows/consolidate-memory.ts
│  ├─ agents/planner.ts
│  ├─ agents/generator.ts
│  ├─ agents/ranker.ts
│  ├─ memory/*
│  └─ providers/*
├─ dashboard routes
│  ├─ character editor
│  ├─ phase editor
│  ├─ playground
│  ├─ evals
│  ├─ traces
│  └─ releases
└─ lib
   ├─ repositories
   ├─ versioning
   ├─ schemas
   └─ integration adapters
```

## Runtime capabilities

- one canonical user×character conversation thread in MVP
- free-form authored phase graph
- planner → generator → ranker pipeline
- layered memory:
  - working memory
  - episodic events
  - semantic recall
  - reflective observations
  - graph facts / supersessions
- stateful appraisal + PAD emotion model
- trace per turn
- background consolidation workflow

## Dashboard capabilities

- edit character card and style settings
- edit free-form phase graph and transition rules
- inspect current pair state and memory
- run side-by-side scenario chats
- run regression eval packs
- compare versions
- publish / rollback

## Why Mastra

Mastra is a TypeScript framework with first-class support for agents, workflows, memory, evals, datasets, and observability, and it has an official Next.js integration path. That makes it a strong fit for a TS-first MVP where runtime and dashboard live in one app. See `SOURCES.md`.

## Read next

- `PRD.md`
- `ARCHITECTURE.md`
- `REPO_STRUCTURE.md`
- `DATA_MODEL.md`
- `WORKFLOWS.md`
- `SCREENS.md`
- `AGENTS.md`
- `prompts/`
