# Emotion / Relationship Regression Baseline

Date: 2026-03-25  
Command: `npm run test:emotion-regression`

Result:
- 10 fixtures executed
- 1 passed: `repeated-pressure`
- 9 failed

## Failing Cases

| Case | Why it fails now |
| --- | --- |
| `compliment` | Positive praise only nudges PAD and pair metrics a little; pleasure, arousal, affinity, and intimacy all undershoot the target band. |
| `mild-rejection` | Soft rejection reads too neutral-to-warm; affinity/trust/intimacy do not cool, conflict does not rise, and CoE does not surface `goalCongruence` on the pleasure axis. |
| `explicit-insult` | Conflict increase is still slightly under the target floor, and CoE treats the insult more like pressure than self-relevant contempt. |
| `apology-repair` | Clear apology under tension still lowers pleasure/trust and raises conflict instead of creating repair movement. |
| `intimacy-escalation-positive-context` | Safe intimacy bids do not produce enough pleasure, arousal, dominance, or intimacy-readiness growth. |
| `intimacy-escalation-across-boundary` | Boundary-crossing intimacy is not negative enough, and `normAlignment` does not appear in the CoE reason fields. |
| `topic-shift-after-tension` | Topic shift after friction slightly raises arousal and intimacy while failing to de-escalate conflict. |
| `two-turn-carry-over` | Turn 2 apology does not recover trust or reduce conflict, and CoE does not show attachment-security-led repair. |
| `five-turn-progression` | Five supportive turns create only a tiny cumulative relationship lift; final-turn warmth and cumulative trust/intimacy growth are far below target. |

## Readout

- The current heuristics already punish repeated pressure strongly enough for this baseline.
- The largest missing behaviors are repair handling, safe-positive intimacy acceleration, and multi-turn positive progression.
- The most obvious CoE gap is boundary cases not surfacing `normAlignment` as a first-class reason.
