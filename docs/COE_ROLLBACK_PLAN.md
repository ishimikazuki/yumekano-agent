# CoE Runtime Rollback Plan (T9)

## Scope
- This plan applies after T9 legacy heuristic runtime deletion.
- Runtime is now canonical `CoE extractor -> integrator` only.

## Feature-flag handling
- Keep `YUMEKANO_USE_COE_INTEGRATOR=false` as the default operational setting.
- In T9 code, this flag is no longer used to re-enable the deleted legacy heuristic path.
- Keep the flag documented so operators have an explicit rollback checklist anchor.

## Rollback steps
1. Immediate safety action:
   Set `YUMEKANO_USE_COE_INTEGRATOR=false` in the environment and restart app processes to keep runtime on the canonical path only.
2. Behavioral rollback action:
   Redeploy the last known T8-compatible release artifact/commit where legacy comparison existed, then run the offline eval suite and confirm reports regenerate.
3. Verification action:
   Re-run `npm run eval:full` in offline mode and check:
   - `tests/evals/emotion-relationship-final-report.md`
   - `tests/evals/emotion-relationship-shadow-report.md`

## Stop conditions for rollback execution
- Stop if the target rollback artifact cannot be identified exactly.
- Stop if eval reports cannot be generated in offline mode.
