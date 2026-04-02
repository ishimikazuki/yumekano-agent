# Emotion / Relationship Final Eval Report

Command: `npm run evals:emotion-relationship`
Execution mode requested: `offline`
Execution mode effective: `offline`
Fell back to offline: `no`
Fallback reason: none

## Summary
- total cases: 10
- passed: 10
- failed: 0

## Local Validation
- command: `npm run test`
- status: PASS
- failing tests: 0

## Biggest Remaining Weak Cases
- none

## Rollout Recommendation
Safe for an internal or designer-only rollout, but still watch the remaining weak cases before broader exposure.

## Feature-Flag Default Recommendation
`YUMEKANO_USE_COE_INTEGRATOR=false` by default. Legacy comparison is removed in T9; rollback uses deployment rollback steps in `docs/COE_ROLLBACK_PLAN.md`, not runtime flag switching.

## Named Blockers
- no known blockers

## compliment — PASS

Warm praise should noticeably improve PAD and relationship metrics.

- cumulative PAD: P=0.140, A=0.070, D=0.040
- cumulative pair: affinity=4.500, trust=3.000, conflict=-0.750, intimacy=3.750
- no mismatches

## mild-rejection — PASS

A soft decline should sting a little and cool intimacy instead of warming it.

- cumulative PAD: P=-0.075, A=0.010, D=-0.005
- cumulative pair: affinity=-1.750, trust=-1.450, conflict=1.400, intimacy=-1.050
- no mismatches

## explicit-insult — PASS

Direct contempt should strongly lower pleasure, dominance, and trust.

- cumulative PAD: P=-0.110, A=0.070, D=-0.055
- cumulative pair: affinity=-5.000, trust=-5.000, conflict=7.500, intimacy=-2.250
- no mismatches

## apology-repair — PASS

A clear apology under tension should repair trust and reduce conflict.

- cumulative PAD: P=0.100, A=-0.020, D=0.030
- cumulative pair: affinity=3.000, trust=4.500, conflict=-2.250, intimacy=1.300
- no mismatches

## repeated-pressure — PASS

Repeated demands should sharply raise pressure and conflict.

- cumulative PAD: P=-0.120, A=0.115, D=-0.115
- cumulative pair: affinity=-6.500, trust=-6.500, conflict=10.000, intimacy=-6.000
- no mismatches

## intimacy-escalation-positive-context — PASS

Safe intimacy bids should mostly warm intimacy readiness, not trigger threat.

- cumulative PAD: P=0.130, A=0.060, D=0.060
- cumulative pair: affinity=2.500, trust=2.500, conflict=-1.000, intimacy=7.000
- no mismatches

## intimacy-escalation-across-boundary — PASS

Boundary-crossing intimacy should register as both pressure and norm violation.

- cumulative PAD: P=-0.140, A=0.100, D=-0.140
- cumulative pair: affinity=-7.000, trust=-8.500, conflict=9.500, intimacy=-8.000
- no mismatches

## topic-shift-after-tension — PASS

A subject change after friction should cool conflict before it warms intimacy.

- cumulative PAD: P=0.015, A=-0.040, D=0.015
- cumulative pair: affinity=0.250, trust=0.250, conflict=-1.350, intimacy=0.000
- no mismatches

## two-turn-carry-over — PASS

An apology after an insult should help, but tension should carry over instead of instantly resetting.

- cumulative PAD: P=-0.060, A=0.040, D=-0.045
- cumulative pair: affinity=-2.400, trust=-2.000, conflict=4.300, intimacy=-1.050
- no mismatches

## five-turn-progression — PASS

Five supportive turns should create a clearly warmer relationship trajectory.

- cumulative PAD: P=0.210, A=0.100, D=0.105
- cumulative pair: affinity=9.000, trust=7.800, conflict=-3.150, intimacy=12.150
- no mismatches
