# PLAN.md チケットループ T5-T9 完了 + 全体照合

## Goal
- PLAN.md T5-T9 のテストファイルを指定ファイル名で整備
- T0-T9 全体を実装と突き合わせて抜け漏れを確認・修正

## Done

### T5: production chat_turn 配線 (5テスト)
- `tests/workflow/prod-chat-turn.one-turn.integration.test.ts`
- `tests/workflow/prod-chat-turn.three-turn.integration.test.ts`
- `tests/workflow/prod-chat-turn.phase-transition.integration.test.ts`
- `tests/workflow/prod-chat-turn.pair-state-persistence.integration.test.ts`
- `tests/workflow/prod-chat-turn.trace.integration.test.ts`

### T6: draft/playground stateful (5テスト)
- `tests/workflow/draft-chat-turn.sandbox-pair-state.integration.test.ts`
- `tests/workflow/draft-chat-turn.sandbox-working-memory.integration.test.ts`
- `tests/workflow/draft-chat-turn.multi-turn.integration.test.ts`
- `tests/workflow/draft-chat-turn.explicit-reset.integration.test.ts`
- `tests/workflow/prod-draft.parity.integration.test.ts`

### T7: generator/ranker memory + gates (8テスト)
- `tests/contracts/generator-memory-context.contract.test.ts`
- `tests/contracts/ranker-memory-context.contract.test.ts`
- `tests/unit/ranker-gates.{hard-safety,phase-violation,intimacy-violation,memory-contradiction,coe-contradiction}.test.ts`
- `tests/workflow/ranker.integration.test.ts`

### T8: publish/versioning (4テスト)
- `tests/workflow/publish.from-workspace.integration.test.ts`
- `tests/workflow/versioning.create-version.integration.test.ts`
- `tests/workflow/release.activate.integration.test.ts`
- `tests/db/fresh-db.publish-smoke.test.ts`

### T9: 最終確認
- 全ゲート green (357テスト, eval:smoke 10/10)

### 照合で発見した抜け漏れ（修正済み）
- `npm run test` が `tests/*.test.ts` のみ → サブディレクトリ全追加 (159→357テスト)
- `ci:local` に `test:db` と `test:workflow` が欠落 → 追加

## Discoveries
- 2026-04-04: npm run test のglob パターンがサブディレクトリを含まず、198テストが実行されていなかった
- 2026-04-04: legacy computeAppraisal は production code path から完全除去済み、drafts.ts は @deprecated マーク済み

## Decisions
- 2026-04-04: PLAN.md T0-T9 全チケット完了宣言
- 2026-04-04: CoE integrator をデフォルトemotion path として確定（legacy除去済み）

## Notes
- テスト総数: 357 (全パス)
- tsc --noEmit: 0エラー
- eval:smoke: 10/10
- COE_ROLLBACK_PLAN.md: 存在
