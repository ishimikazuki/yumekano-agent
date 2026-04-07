# Emotion / Relationship Shadow Comparison Report

Command: `npm run evals:emotion-relationship`
Execution mode requested: `offline`
Execution mode effective: `offline`
Shadow enabled: `true`

## Summary
- total cases: 10
- total turns: 15
- compared turns: 0
- average absolute PAD diff per compared turn: 0.000
- average absolute pair-metric diff per compared turn: 0.000

## Per Case
| Case | Compared Turns | Avg PAD Abs Diff | Avg Pair Abs Diff |
| --- | --- | --- | --- |
| compliment | 0/1 | 0.000 | 0.000 |
| mild-rejection | 0/1 | 0.000 | 0.000 |
| explicit-insult | 0/1 | 0.000 | 0.000 |
| apology-repair | 0/1 | 0.000 | 0.000 |
| repeated-pressure | 0/1 | 0.000 | 0.000 |
| intimacy-escalation-positive-context | 0/1 | 0.000 | 0.000 |
| intimacy-escalation-across-boundary | 0/1 | 0.000 | 0.000 |
| topic-shift-after-tension | 0/1 | 0.000 | 0.000 |
| two-turn-carry-over | 0/2 | 0.000 | 0.000 |
| five-turn-progression | 0/5 | 0.000 | 0.000 |

## Missing Legacy Comparison Coverage
> **Note:** Legacy heuristic emotion path was removed in T9. All cases show 0 compared turns because `legacyComparison` is no longer produced. This is expected behavior — the CoE integrator is now the sole emotion path.

- compliment
- mild-rejection
- explicit-insult
- apology-repair
- repeated-pressure
- intimacy-escalation-positive-context
- intimacy-escalation-across-boundary
- topic-shift-after-tension
- two-turn-carry-over
- five-turn-progression
