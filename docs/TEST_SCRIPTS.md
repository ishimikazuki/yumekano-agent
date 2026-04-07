# Test Scripts Reference

## Script Roles

| Script | Role | Scope | Live Model? |
|--------|------|-------|-------------|
| `test` | Repo standard gate — broadest local test suite | All: unit, contract, db, workflow, evals/emotion | No |
| `test:unit` | Unit & contract tests only | `tests/contracts/`, `tests/unit/` | No |
| `test:db` | DB smoke tests — migration, seed, schema | `tests/db-smoke.test.ts`, `tests/db/fresh-db.*.test.ts` | No |
| `test:workflow` | Workflow smoke tests | `tests/workflow-smoke.test.ts`, `tests/workflow/chat-turn.smoke.test.ts` | No |
| `test:integration` | Integration tests (execute-turn, draft-chat) | `tests/execute-turn-coe-integration.test.ts`, `tests/draft-chat-stateful.test.ts` | No |
| `test:migrations` | Migration consistency tests | `tests/prompt-bundle-persistence.test.ts`, `tests/eval-active-lock.test.ts` | No |
| `test:ranker-gates` | Ranker deterministic gate tests | `tests/ranker-gates.test.ts` | No |
| `test:coe-integrator` | CoE integrator & feature flag tests | `tests/coe-integrator.test.ts`, `tests/feature-flags.test.ts`, `tests/legacy-config-normalization.test.ts` | No |
| `test:emotion-regression` | Emotion/relationship regression fixtures | `tests/evals/emotion/*.test.ts` | No |
| `eval:smoke` | Evaluation smoke run (offline mode) | `src/scripts/run-emotion-relationship-evals.ts` | No (offline) |
| `ci:local` | Full local CI gate — runs before merge | Combines: db, workflow, integration, migrations, ranker-gates, coe-integrator, emotion-regression, eval:smoke | No |

## Hierarchy

```
test            (broadest — repo standard gate, all directories)
├── test:unit   (contracts + unit only)
├── test:db     (DB smoke)
├── test:workflow (workflow smoke)
└── ...others

ci:local        (pre-merge gate — ordered chain)
├── test:db
├── test:workflow
├── test:integration
├── test:migrations
├── test:ranker-gates
├── test:coe-integrator
├── test:emotion-regression
└── eval:smoke
```

## eval:smoke Prerequisites

- Requires `YUMEKANO_EVAL_MODE=offline` (set automatically by the script)
- Does NOT call a live model — uses offline/deterministic mode
- Runs `src/scripts/run-emotion-relationship-evals.ts` with fixture data
- No API keys or external services needed

## When to Use Each

| Scenario | Command |
|----------|---------|
| Quick unit check during development | `npm run test:unit` |
| After schema/migration change | `npm run test:db` |
| After workflow/chat-turn change | `npm run test:workflow` |
| After emotion/CoE change | `npm run test:emotion-regression` |
| Before committing (full local check) | `npm run ci:local` |
| Full repo gate | `npm run test` |
