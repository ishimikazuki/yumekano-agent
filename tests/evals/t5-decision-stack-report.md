# T5: Decision Stack Ablation Report

**Date**: 2026-04-21
**Status**: Green — defaults held across the board

## Scope

Evaluate whether `planner`, `ranker`, and `CoE extractor` can be safely lowered from `decisionHigh` (grok-4-1-fast-reasoning) without user-visible quality regression.

## Methodology

- Offline eval (ci:local) is fixture-based — `YUMEKANO_EVAL_MODE=offline` does not exercise live model calls, so an actual tier swap is a no-op in CI.
- Contract + regression tests lock in the current defaults and catch silent drift.
- Live A/B ablation is not wired into this repo; it requires a separate operator-driven run against `xAI` API.

## Per-stage decision

### planner
- **Default**: `decisionHigh`
- **Decision**: **held**
- **Rationale**: planner determines stance, acts, intimacy decision, and mustAvoid. A regression here corrupts the generator's seed, showing up as shallow or off-tone replies. Live ablation required before lowering.
- **Operator override**: none yet; would require alias split + eval infrastructure.

### ranker
- **Default**: `decisionHigh`
- **Decision**: **held**
- **Rationale**: ranker has deterministic hard-safety / phase / intimacy gates that absorb some risk, but LLM-based scorers (persona consistency, emotional coherence, memory grounding, etc.) directly feed winner selection. A scorer regression ships to the user. Live ablation required.

### CoE extractor
- **Default**: `decisionHigh`
- **Decision**: **held (highest bar)**
- **Rationale**: CoE evidence extraction updates PAD + relationship metrics that persist across turns. Unlike planner/ranker where a bad decision affects one turn, a bad CoE extraction silently corrupts internal state for every subsequent turn. Highest risk of regression propagation.

## Summary table

| Stage | Default alias | Default model | Decision | Override path |
|---|---|---|---|---|
| generator | surfaceResponseHigh | grok-4.20-reasoning | held (never lowered) | — |
| planner | decisionHigh | grok-4-1-fast-reasoning | **held** | live A/B required |
| ranker | decisionHigh | grok-4-1-fast-reasoning | **held** | live A/B required |
| coeExtractor | decisionHigh | grok-4-1-fast-reasoning | **held** | live A/B required |
| memoryExtractor | structuredPostturnFast | grok-4-fast-reasoning | lowered in T2-B | STRUCTURED_POSTTURN_MODEL env |
| reflector / narrator / persona compiler | maintenanceFast | grok-4-fast-reasoning | lowered in T2-B | MAINTENANCE_MODEL env |

## Next steps (T6)

- T6 should define two operational profiles:
  - `poc_quality_first`: all decision stack on decisionHigh (current default)
  - `poc_balanced_latency`: use live-A/B evidence to justify any further lowering
- T6 owns the final profile selection + documentation.

## Deliverables

- `tests/evals/planner-tier-ablation.eval.ts` — 3/3 pass
- `tests/evals/ranker-tier-ablation.eval.ts` — 3/3 pass
- `tests/evals/coe-tier-ablation.eval.ts` — 3/3 pass
- `tests/regression/decision-stack-quality.regression.test.ts` — 5/5 pass
- This report

## Recommended default

**No changes to default model routing.** The decision stack stays on `decisionHigh` (grok-4-1-fast-reasoning). Only memory extractor and maintenance aliases are lowered (done in T2-B).
