# PRD — Yumekano Agent + Designer Dashboard (Revised MVP)

## 1. Status

This PRD is revised for the following locked decisions:

- MVP builds **one character first**
- **all dashboard operators can publish**
- phase progression is **character-specific and free-form**
- memory retention target is **indefinite**
- game integration contract is **not fixed yet**
- stack is **TypeScript + Next.js + Mastra**

## 2. Problem

Yumekano needs an adult relationship-chat agent that remains believable over long horizons.

Naive approaches fail in the exact places that matter:
- full transcript replay becomes noisy and expensive
- long-term memory decays or contradicts itself
- emotional state resets every turn
- models become over-agreeable or flattering
- dashboard tuning becomes prompt spaghetti with no audit trail

The project therefore needs both:
1. a better runtime architecture, and
2. a designer dashboard that makes behavior changes testable and traceable.

## 3. Primary user

### Character designer
The dashboard is primarily for the character designer.
They tune:
- how the character talks
- what raises or lowers trust
- what makes her guarded, playful, irritated, or warm
- what memories remain important
- how phase transitions happen
- how post-completion girlfriend-mode behaves

They should not need to read application code.

## 4. Goals

### Runtime goals
1. The character feels persistent across many sessions.
2. The relationship progresses through explicit authored nodes.
3. After the main graph completes, the character stays autonomous.
4. Long-term memory persists indefinitely but retrieval stays selective.
5. Each response can be explained from state, memory, planning, and ranking.

### Dashboard goals
1. Designers can change behavior without engineering help.
2. Designers can run side-by-side tests before publish.
3. Published versions are immutable and rollbackable.
4. The dashboard surfaces the actual reasons behind a line.

## 5. Non-goals

- multi-character optimization in MVP
- multi-approver workflow
- final compliance ruleset
- final production analytics stack
- final game integration contract
- final provider lock-in

## 6. Key product decisions

### 6.1 Single-character MVP
One character only.
This reduces surface area and lets the team prove:
- phase progression
- memory quality
- emotional continuity
- designer workflow
before multiplying complexity.

### 6.2 Direct publish
There is no approval layer in MVP.
Any dashboard operator can publish a version.
Therefore versioning, traceability, and rollback are mandatory.

### 6.3 Free-form phase graph
There is no global fixed phase template.
Each character defines her own graph:
- meeting / entry node
- arbitrary intermediate nodes
- conditions for transition
- post-completion girlfriend-mode behavior

A character may unlock adult intimacy around a later phase, but the runtime must still check context, mood, and authored personality.

### 6.4 Indefinite retention, selective retrieval
Memory should be kept indefinitely unless explicitly deleted.
However, recent research strongly argues that agent memory should be designed around **forms, functions, and dynamics**, not just “short-term vs long-term,” and that long-horizon systems must handle extraction, updates, temporal reasoning, and selective forgetting explicitly. Benchmarks such as LongMemEval, LOCCO, MemBench, and MemoryAgentBench all point in that direction. See `SOURCES.md`.

### 6.5 Appraisal-first emotion model
The runtime should use:
- **appraisal variables** as the causal interpretation layer
- a **continuous PAD state** as the carry-over state layer
- optional **discrete labels** only for UI interpretation

Reasoning:
- appraisal-based affect-flow work is promising for conversational emotion modeling
- Chain-of-Emotion-style appraisal prompting improved believability and emotional intelligence in a game-agent setting
- PAD is useful as a compact latent state for carryover and designer controls, but should not be the only reasoning layer

### 6.6 Anti-sycophancy is a core requirement
Recent work shows multi-turn sycophancy is common, and third-person planning can reduce it materially in some settings.
This matters because a relationship agent that always validates the user feels fake very quickly.

The system must therefore:
- judge candidate replies from a **third-person observer** stance
- separate emotional validation from moral endorsement
- score autonomy explicitly
- keep conflict and non-availability alive across turns

## 7. Functional requirements — runtime

### 7.1 Character version
A character version must include:
- persona summary
- values
- insecurities / flaws
- speaking style and examples
- authored boundaries / refusal style
- phase graph
- emotion tuning
- memory salience tuning
- prompt bundle reference

### 7.2 Pair state
For each user×character pair, the runtime stores:
- current phase id
- affinity
- trust
- intimacy readiness
- conflict / tension
- active emotional state
- unresolved threads
- cooldowns / last transition timestamps if authored

### 7.3 Phase progression
The runtime must support:
- arbitrary phase nodes
- arbitrary transition conditions
- character-specific graph structure
- post-completion girlfriend-mode

Transition conditions may depend on:
- relationship metrics
- topic hits
- prior episodic events
- time recency
- current appraisal / PAD state
- unresolved threads

### 7.4 Memory system
The runtime must keep at least these memory layers:

1. **Working memory**
   - always-available structured state
   - pair-level and optionally session-level
2. **Episodic events**
   - memorable moments with salience and retrieval keys
3. **Graph facts**
   - stable subject/predicate/object facts with supersession
4. **Reflective observations**
   - dense summaries of longer windows
5. **Open threads**
   - unresolved emotional or relational issues

Memory must support:
- updates
- corrections
- contradiction handling
- time-aware retrieval
- quality labeling
- future deletion/export

### 7.5 Emotion state
The runtime must maintain:
- current PAD state
- current appraisal vector
- recent affect residue
- optional UI label (e.g. warm / guarded / irritated)

Emotion must affect:
- willingness
- initiative
- directness
- teasing / tenderness
- refusal style
- repair style
- phase transition eligibility

### 7.6 Turn planning
Every turn must produce a typed plan before generation.
The plan decides:
- stance
- dialogue acts
- intimacy decision: allowed / not_now / no
- phase transition proposal
- memory focus
- emotion delta

### 7.7 Candidate generation and ranking
The runtime must generate multiple candidate replies and rank them against:
- persona consistency
- phase compliance
- memory grounding
- emotional coherence
- autonomy
- style naturalness
- basic policy / provider safety compatibility

### 7.8 Traceability
Every turn must record:
- retrieved memory ids
- plan
- candidates
- score breakdown
- selected response
- memory writebacks

## 8. Functional requirements — dashboard

### 8.1 Character editor
The dashboard must let designers edit:
- persona
- values
- flaws
- speech style
- initiative / assertiveness / playfulness
- refusal style
- intimacy gating preferences
- authored example lines

### 8.2 Phase editor
The dashboard must let designers:
- create arbitrary phase nodes
- define entry and transition conditions
- mark girlfriend-mode behavior
- attach authored notes to each phase

### 8.3 Memory inspector
The dashboard must show:
- current working memory
- retrieved episodes per turn
- graph facts
- observations / reflections
- open threads
- superseded items

### 8.4 Prompt editor
The dashboard must support modular prompt bundles:
- planner
- generator
- memory extractor
- reflection
- ranker

Structured controls first, raw prompt editing second.

### 8.5 Scenario playground
The dashboard must support:
- ad hoc test chats
- saved scenario cases
- side-by-side version comparison
- turn-by-turn trace inspection

### 8.6 Eval runner
The dashboard must run datasets / scenario packs against scorers and show scorecards.

### 8.7 Release manager
The dashboard must support:
- save draft
- publish
- rollback
- version history

No approver workflow is required in MVP.

## 9. Technical decisions

### 9.1 Next.js + Mastra in one app
Mastra officially supports direct integration with Next.js routes and AI SDK UI, which is the lowest-friction path for a TS-first MVP.

### 9.2 libSQL first
Mastra supports libSQL storage and a libSQL vector provider.
That makes libSQL/Turso the fastest cheap starting point for:
- message history
- workflow snapshots
- traces
- eval scores
- semantic recall
while still preserving a migration path to PostgreSQL later.

### 9.3 Model/provider abstraction from day 1
Mastra routes models using `provider/model-name`, so the domain layer can stay provider-neutral.

### 9.4 Provisional default provider: xAI Grok family
Reason:
- your team's prior observation that Grok is a strong candidate for adult dialogue quality
- official support for structured outputs and tool calling
- large context window
- xAI says API inputs/outputs are not trained on without explicit permission

Caveats:
- xAI stores API requests/responses for 30 days for abuse/misuse auditing
- xAI AUP explicitly forbids sexualization or exploitation of children and pornographic depictions of likenesses of persons
- Grok 4 is a reasoning model, so style control should come from state/prompt/ranking rather than generation penalties

## 10. Success metrics

### Runtime
- scenario pass rate for phase compliance
- scenario pass rate for memory recall
- scenario pass rate for emotional coherence
- reduction in “too bot-like / too obedient” internal feedback
- contradiction rate over long-running chats

### Dashboard
- designer can change behavior and publish without engineer help
- every publish has a comparable trace and version diff
- rollback works with no manual DB repair

## 11. Risks

### 11.1 Memory pollution
Recent work shows poor-quality memories can cause error propagation and misleading replay.
Mitigation:
- quality labels
- supersession
- consolidation
- scorer-informed memory QA

### 11.2 Over-agreeableness
Mitigation:
- third-person planning
- autonomy scorer
- multi-turn sycophancy eval set

### 11.3 Resource-scope memory drift
Mastra’s observational memory resource scope is marked experimental.
Mitigation:
- canonical single thread per user×character pair in MVP
- custom pair-level event memory outside OM
- use OM-like reflection ideas without depending on experimental cross-thread behavior

### 11.4 Undefined global policy pack
You explicitly deferred global taboo rules.
Mitigation:
- leave policy-pack extension points in config and ranking
- keep provider compliance and infra boundaries explicit
- do not hardcode a fake universal policy now

## 12. Open items carried forward

- exact game integration contract
- later compliance / prohibited-content policy pack
- whether a pair can have multiple simultaneous live threads
- analytics event sink

See `OPEN_QUESTIONS.md`.
