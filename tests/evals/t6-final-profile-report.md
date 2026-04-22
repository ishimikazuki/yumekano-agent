# T6: Final Operational Profile Report

**Date**: 2026-04-21
**Status**: Green — recommended default = `poc_balanced_latency`

## Purpose

Fix the POC's operational model routing after T0–T5 optimization. Provide two named profiles so operators can A/B or roll back without code changes.

## Profiles

### `poc_quality_first`
Every analysis stage on the high tier. Used as a quality reference and as a rollback profile.

| Role | Model |
|---|---|
| surfaceResponseHigh | `grok-4.20-reasoning` |
| decisionHigh | `grok-4-1-fast-reasoning` |
| structuredPostturnFast | `grok-4-1-fast-reasoning` ← same as decisionHigh |
| maintenanceFast | `grok-4-1-fast-reasoning` ← same as decisionHigh |
| embeddingDefault | `v1` |

**Use when**: quality regression is detected in live ops and rollback is needed before live A/B is ready.

### `poc_balanced_latency` (RECOMMENDED)
Surface + decision stack on the high tier. Memory extractor + maintenance on the fast tier.

| Role | Model |
|---|---|
| surfaceResponseHigh | `grok-4.20-reasoning` |
| decisionHigh | `grok-4-1-fast-reasoning` |
| structuredPostturnFast | `grok-4-fast-reasoning` ← lowered in T2-B |
| maintenanceFast | `grok-4-fast-reasoning` ← lowered in T2-B |
| embeddingDefault | `v1` |

**Use when**: POC default. Matches `defaultModelRoles` exactly. Every ci:local gate is green against this profile.

## Per-stage rationale

| Stage | Tier | Reason |
|---|---|---|
| generator | high | directly user-visible — never lowered |
| planner | high | shapes stance / acts / intimacy decision — held in T5 |
| ranker | high | final candidate selection — held in T5 |
| CoE extractor | high | updates multi-turn state — highest bar, held in T5 |
| scorers | high | feed ranker decision — held |
| memory extractor | **fast** | runs after reply is finalized — lowered in T2-B |
| reflector | **fast** | post-turn maintenance — lowered in T2-B |
| emotion-narrator | **fast** | narrative generated via `after()` — lowered in T2-B |
| persona compiler | **fast** | design-time tool — lowered in T2-B |

## Latency improvements (from prior tickets)

| Ticket | Change | Latency impact |
|---|---|---|
| T2-B | memory extractor → grok-4-fast-reasoning | per-turn latency ↓ (post-turn stage faster) |
| T3 | consolidation moved to Next.js `after()` | API response no longer waits for consolidation |
| T3 | salience-aware gating (`salienceFloor`) | low-salience turns skip consolidation entirely |

## Regression gate status (2026-04-21)

- `npm run ci:local` → all green
- `npm run typecheck` → clean
- emotion regression → 91/91
- eval:smoke → 10/10
- `tests/contracts/operational-profiles.contract.test.ts` → 6/6

## Rollback path (no code change required)

```bash
# Rollback memory extractor to the decisionHigh tier
export STRUCTURED_POSTTURN_MODEL=grok-4-1-fast-reasoning
# Rollback maintenance tier similarly
export MAINTENANCE_MODEL=grok-4-1-fast-reasoning
```

Set both and restart the process. `defaultModelRoles` resolves env vars at startup, so the balanced profile collapses back to `poc_quality_first` in seconds.

## Out of scope (deferred)

- Live A/B for planner / ranker / CoE extractor tier lowering
  → deferred to operator-driven online eval (requires `XAI_API_KEY` + `YUMEKANO_EVAL_MODE=online`).
- Per-stage env var splitting for the decision stack
  → not needed until live A/B justifies the split.

## Final recommendation

**Adopt `poc_balanced_latency` as the POC default.** It is already the `defaultModelRoles` baseline, locked in by `operational-profiles.contract.test.ts`. If live ops show regression on the fast tier, flip to `poc_quality_first` via the env-var rollback above.
