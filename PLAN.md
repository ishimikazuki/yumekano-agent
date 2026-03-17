# PLAN — Implementation Order

## Planning assumptions

- one character MVP
- one repo
- one canonical conversation thread per user×character pair
- cheap infra first
- publish directly from dashboard
- no final game backend integration yet

---

## Phase 0 — Bootstrap

### Outcome
A running Next.js + Mastra app with typed storage and a fake local character.

### Tasks
- initialize Next.js App Router project
- initialize Mastra
- configure libSQL storage and libSQL vector provider
- define base Zod schemas
- set up provider registry
- set up trace logging
- create seed character version

### Exit criteria
- `/api/chat` works
- storage and traces persist
- one seed character loads from data, not code branches

---

## Phase 1 — Core runtime domain model

### Outcome
Typed entities exist for character versions, phase graph, pair state, memory, prompt bundles, scenarios, and releases.

### Tasks
- implement repositories
- implement versioning helpers
- implement pair state service
- implement phase rule evaluator
- implement release model

### Exit criteria
- can create and read a character version
- can resolve current phase for a pair
- can publish and rollback a version

---

## Phase 2 — Memory system

### Outcome
Layered memory works end to end.

### Tasks
- working memory schema
- episodic event ledger
- graph facts with supersession
- observation blocks / reflections
- retrieval pipeline with budgeting
- session consolidation workflow

### Exit criteria
- a conversation can create durable events
- later turns retrieve relevant memory selectively
- corrected facts supersede old ones rather than silently overwrite them

---

## Phase 3 — Emotion and planning

### Outcome
Turns are driven by typed planning, not freeform generation alone.

### Tasks
- appraisal feature extractor
- PAD update function
- plan schema
- planner agent
- phase transition proposal logic
- intimacy decision logic
- stance logic

### Exit criteria
- every turn has a plan object
- traces show emotion before/after
- phase transitions are explainable

---

## Phase 4 — Candidate generation and ranking

### Outcome
One-shot failure rate drops and behavior becomes auditable.

### Tasks
- candidate generator
- ranker agent
- deterministic post-checks
- score breakdown storage
- winner selection

### Exit criteria
- traces show all candidates and scorecards
- ranker can reject phase-invalid or overly compliant outputs

---

## Phase 5 — Designer dashboard

### Outcome
Character designer can tune and test without touching code.

### Pages
- character editor
- phase editor
- playground
- traces
- evals
- releases

### Exit criteria
- designer can edit a draft version
- run a test chat
- inspect memory and plan
- publish and rollback

---

## Phase 6 — Evals and regression packs

### Outcome
Behavior changes are testable before publish.

### Tasks
- scenario case schema
- scorer suite
- eval runner
- side-by-side comparison UI
- baseline snapshots

### Initial scorer set
- persona consistency
- phase compliance
- memory grounding
- emotional coherence
- autonomy / anti-sycophancy
- refusal naturalness

### Exit criteria
- a release can attach eval results
- a failing scorer is visible before publish

---

## Phase 7 — Codex handoff hardening

### Outcome
The repo is easy for Codex or a human engineer to extend.

### Tasks
- complete `AGENTS.md`
- add examples and seeds
- ensure schemas and interfaces are discoverable
- add fixture conversations
- add developer scripts

### Exit criteria
- new contributors can understand the system from docs and repo layout alone

---

## Suggested build order inside the repo

1. schemas
2. repositories
3. chat_turn workflow
4. memory writeback
5. planner
6. generator + ranker
7. dashboard read-only views
8. dashboard editors
9. eval runner
10. release manager

---

## What to postpone deliberately

- multi-character support
- multi-approver publish
- canary routing
- external analytics warehouse
- production queue infrastructure
- multi-thread cross-session memory beyond the canonical pair thread
