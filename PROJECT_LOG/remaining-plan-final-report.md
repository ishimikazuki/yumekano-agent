# 残件修正プラン — Final Regression Report

**Date**: 2026-04-08
**Plan**: yumekano-agent 残件修正プラン（T0-T5）

## Gate Results

| Command | Result | Count |
|---------|--------|-------|
| `npm run test` | **PASS** | 458 pass, 0 fail |
| `npm run test:db` | **PASS** | 10 pass, 0 fail |
| `npm run test:workflow` | **PASS** | 12 pass, 0 fail |
| `npm run test:integration` | **PASS** | 5 pass, 0 fail |
| `npm run test:migrations` | **PASS** | 5 pass, 0 fail |
| `npm run test:ranker-gates` | **PASS** | 12 pass, 0 fail |
| `npm run test:coe-integrator` | **PASS** | 12 pass, 0 fail |
| `npm run test:emotion-regression` | **PASS** | 91 pass, 0 fail |
| `npm run eval:smoke` | **PASS** | 10/10 scenarios |
| `npm run ci:local` | **PASS** | Full chain |

## Ticket Summary

| Ticket | Goal | Status |
|--------|------|--------|
| T0 | テストゲートの意味論を固定 | **GREEN** (already complete from prior plan) |
| T1 | migration の二重定義を整理 | **GREEN** (SQL files synced, 21 new tests) |
| T2 | legacy comparison を実装し trace に残す | **GREEN** (computeLegacyComparison flag, 14 new tests) |
| T3 | prod/draft の trace parity を固定 | **GREEN** (10 new contract tests) |
| T4 | canonical publish path を確定 | **GREEN** (docs updated, existing tests pass) |
| T5 | 最終 gate / rollout / completion 判定 | **GREEN** (this report) |

## Rollout Recommendation

### computeLegacyComparison flag
- **Default**: `false` (disabled)
- **Purpose**: Trace-only comparison between legacy heuristic and new CoE path
- **Recommendation**: Keep disabled in production. Enable selectively for analysis/debugging when comparing old vs new emotion paths.
- **Impact when enabled**: No mainline behavior change. Only adds comparison payload to trace.

### CoE path
- New CoE path is the sole production path
- Legacy heuristic path is fully removed from mainline
- Legacy comparison is available as an opt-in diagnostic tool

## Remaining Blockers

**None.** All gates pass.

## Release Readiness

**RELEASE-READY**

All local gates pass. No hidden blockers. The remaining plan's 5 issues have been addressed:
1. Test gate semantics — fixed and contract-tested
2. Migration duplicates — synced SQL files, canonical definitions in 001/002
3. Legacy comparison — implemented as opt-in diagnostic via `computeLegacyComparison`
4. Trace parity — prod/draft share same TurnTrace shape via executeTurn
5. Publish path — workspace-backed is the only active route, documented

## Engineering Notes

- Migration files 004/006/008 are no-ops with SUPERSEDED comments (runtime and SQL files aligned)
- `mapLegacyToCanonicalRelational` was exported from coe-emotion-contract adapter for the comparison feature
- Draft trace persistence uses `playground_turns.trace_json` (JSON blob), prod uses `turn_traces` (individual columns). Same shape via executeTurn.
- Total test count: 458 (up from prior baseline)
