# Contract Drift Audit

Updated: 2026-03-24

## Fixed drift

| Area | Before | After |
| --- | --- | --- |
| Planner contract | `prompts/planner.system.md` used `dialogueActs`, `phaseTransition`, object-style `intimacyDecision` | Planner prompt now matches `TurnPlanSchema` exactly |
| Generator contract | Prompt example returned a single object with `shouldSplit` | Prompt example now returns `candidates[]` matching `GeneratorOutputSchema` |
| Ranker contract | Prompt example returned `globalNotes: []` | Prompt example now returns `globalNotes: string` matching `RankerOutputSchema` |
| Prompt bundle wiring | Designer prompt replaced runtime prompt context | Designer prompt is now treated as a fragment and merged into invariant runtime context |
| PAD persistence | Only combined PAD was stored | `pair_state` and `sandbox_pair_state` now persist `fast/slow/combined` plus `last_emotion_updated_at` |
| Turn trace | Trace stored only combined PAD before/after | Trace now stores emotion layers, relationship deltas, phase evaluation, prompt hashes, threshold decisions |
| Memory writeback | `sourceTurnId` was null and thresholds were unused | Memory writes now attach `sourceTurnId`, apply thresholds, and supersede matching facts when requested |

## Guardrails

- `tests/prompt-contracts.test.ts` fails if prompt markdown falls back to deprecated keys.
- `src/mastra/prompts/assemble.ts` centralizes prompt assembly and hashing.
- `005_runtime_emotion_and_trace.sql` backfills existing rows so old combined PAD state becomes the initial fast/slow/combined payload.
