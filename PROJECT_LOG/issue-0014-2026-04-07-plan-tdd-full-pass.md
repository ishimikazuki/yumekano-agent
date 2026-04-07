# plan_tdd.md T0-T9 全チケット完了 + デプロイ

## Goal
- plan_tdd.md（一新された TDD チケットプラン）の T0-T9 を全て実施する
- 前回の評価で指摘された問題を修正する
- Vercel にデプロイする

## Done

### 実コード修正
| Ticket | 修正内容 |
|--------|---------|
| T0 | `test:unit` 分離、`ci:local` に emotion-regression 追加、`docs/TEST_SCRIPTS.md` |
| T1 | MIGRATION_004/006/008 を no-op 化（二重定義解消） |
| T2 | formatDesignerFragment 検証テスト追加（コード修正不要） |
| T4 | `enableLegacyComparison` を 3ファイルから削除（legacy path 削除済みで不要） |
| T9 | 旧テスト競合修正（SQLITE_BUSY）、migration consistency テスト更新、旧重複テスト削除 |

### 新規テスト追加
- `tests/contracts/test-gate-contract.test.ts`
- `tests/contracts/ci-local-coverage.contract.test.ts`
- `tests/contracts/prompt-bundle.persistence.contract.test.ts`
- `tests/contracts/workspace-draft.persistence.contract.test.ts`
- `tests/contracts/sandbox-memory.persistence.contract.test.ts` (migration dedup RED→GREEN)
- `tests/contracts/legacy-draft-path.quarantine.test.ts`
- `tests/contracts/prompt-override.behavior.test.ts` (3テスト追加)
- `tests/db/fresh-db.workspace-and-prompt-contract.test.ts`
- `tests/db/fresh-db.sandbox-schema-smoke.test.ts`
- `tests/unit/legacy-comparison.trace-shape.test.ts` (RED→GREEN)
- `tests/workflow/prod-chat-turn.legacy-comparison.integration.test.ts`
- `tests/workflow/prod-draft.trace-parity.integration.test.ts`

### Hook 改善
- `check-stop.sh`: チケット完了時に次チケットへ自動進行
- `start-ticket.py`: plan_tdd.md フォーマット対応

### HOTFIX (別セッション)
- sandbox の undefined value エラー修正（3 commit: af2e30e, 4a63027, 16f9662）

## Discoveries
- 2026-04-07: 旧サイクル(PLAN.md)のテストが repo に残っており、plan_tdd.md のテストと同名。最初「通るからOK」でスキップし、指摘を受けてやり直した。
- 2026-04-07: `enableLegacyComparison` フラグが残っていたが、legacy 関数 (`computeAppraisal` 等) は commit 02b13cd で完全削除済み。フラグは dead code だった。
- 2026-04-07: prod/draft の trace 保存先は設計上意図的に異なる (prod=turn_traces, draft=playground_turns.trace_json)。shape は同一（executeTurn が構築）。

## Decisions
- 2026-04-07: MIGRATION_004/006/008 は `SELECT 1` (no-op) にし、_migrations トラッキングは維持。
- 2026-04-07: `enableLegacyComparison` 削除。legacy path が完全に削除されているため feature flag 不要。
- 2026-04-07: prod/draft trace parity は「storage 先が異なるが shape は同一」を正とする。

## Notes
- 417 テスト全パス、ci:local green
- Vercel デプロイ成功: https://yumekano-codex-spec-v2.vercel.app
