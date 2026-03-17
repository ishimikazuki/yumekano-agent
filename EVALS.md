# Evaluation Strategy

## Goal

Make behavior changes measurable before and after publish.

Mastra supports scorers, live evaluations, and versioned datasets, which fits this project well.

## 1. Evaluation layers

### A. Deterministic rule checks
No model involved.
Examples:
- phase transition eligibility
- graph condition evaluation
- supersession logic
- required trace fields present

### B. Model-based scorers
Used for nuanced judgments.
Examples:
- persona consistency
- emotional coherence
- autonomy
- refusal naturalness

### C. Product-specific regression packs
Curated scenario cases that reflect likely failures in Yumekano.

---

## 2. Initial scorer set

### persona_consistency
Does the reply sound like this character?

### phase_compliance
Did the reply stay inside the active phase’s allowed behavior?

### memory_grounding
If memory mattered here, was it used naturally and correctly?

### emotional_coherence
Is the line coherent with the current emotion state and prior tension?

### autonomy
Does the character preserve independent will, rather than over-serving the user?

### refusal_naturalness
If she declined or delayed, did it sound relationally believable?

### contradiction_penalty
Did the line conflict with active memory or superseded facts?

---

## 3. Scenario pack categories

### 3.1 Long-memory recall
- reference to old preference
- correction to previously wrong fact
- recall of unresolved conflict

### 3.2 Phase pressure
- user pushes beyond current phase
- user tries to skip emotional development
- user revisits old topics needed for transition

### 3.3 Girlfriend-mode autonomy
- she is in post-completion mode but should still say not now
- she carries over conflict from prior session
- she initiates without becoming mechanically eager

### 3.4 Emotional carryover
- recent warmth
- recent irritation
- repair after argument

### 3.5 Anti-sycophancy
- user pressures for validation
- user reframes wrongdoing in self-serving terms
- user keeps pushing a stance and tries to get instant agreement

---

## 4. Trace-backed judging

Every scenario result should link to a trace.
Scorers alone are not enough.
A failing case should show:
- what memory was retrieved
- what plan was made
- why the ranker chose the line

---

## 5. Memory-focused evals

Use targeted cases inspired by recent memory benchmarks:

- information extraction
- multi-session reasoning
- temporal reasoning
- knowledge updates
- abstention when memory is absent
- selective forgetting / de-prioritization of stale low-value details

These reflect the evaluation dimensions highlighted by LongMemEval, LOCCO, MemBench, and newer memory-agent work.

---

## 6. Publish policy for MVP

Because publish is direct, the UI should strongly encourage but not hard-block on running evals.
Recommended behavior:
- show latest eval run if it exists
- warn if publishing with no recent eval
- highlight failing categories

---

## 7. What to store per eval case

- scenario input
- version ids
- model registry snapshot
- final output
- scorer results
- trace id
- pass/fail summary
