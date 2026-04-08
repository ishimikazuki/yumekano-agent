# 残件修正プラン T0-T5 全完了

## Goal
前回TDDプラン(T0-T9)完了後に残った5つの論点を ticket 化して修正する。

## Done
- **T0**: テストゲートの意味論を固定 — 既に前プランで完了済み、確認のみ
- **T1**: migration 二重定義整理 — SQL ファイル 004/006/008 を no-op に同期、21テスト追加
- **T2**: legacy comparison 実装 — `computeLegacyComparison` フラグ追加、`buildLegacyComparisonResult` 関数実装、14テスト追加
- **T3**: prod/draft trace parity 固定 — 10テスト追加（draft-trace-shape, prod-trace-shape contract）
- **T4**: canonical publish path 確定 — docs/DESIGNER_GUIDE.md にパブリッシュフロー追記
- **T5**: 最終ゲート — 458テスト全パス、RELEASE-READY 判定
- **hook修正**: `check-stop.sh` の TICKET_ORDER を T0-T5 に更新（旧 T0-T9 が無限ループ原因）

## Discoveries
- 旧プランT0の修正が残件プランT0と重複していた（既に修正済み）
- `enableLegacyComparison` は旧T4で削除済み → 新 `computeLegacyComparison` で再実装
- Draft trace は playground_turns.trace_json (JSON blob)、Prod は turn_traces (個別カラム) — shape は executeTurn で同一
- check-stop.sh の TICKET_ORDER がハードコードされており、プラン変更時に手動更新が必要

## Decisions
- 2026-04-08: legacy comparison は `computeLegacyComparison` フラグ（デフォルト false）で制御。trace-only で mainline に影響なし
- 2026-04-08: migration 004/006/008 は no-op + SUPERSEDED コメントとして保持（_migrations 追跡のため削除しない）

## Files Changed
- `src/mastra/workflows/execute-turn.ts` — computeLegacyComparison フラグ + buildLegacyComparisonResult
- `src/lib/adapters/coe-emotion-contract.ts` — mapLegacyToCanonicalRelational を export
- `src/lib/db/migrations/004_generator_intimacy_prompt.sql` — no-op に同期
- `src/lib/db/migrations/006_sandbox_memory_parity.sql` — no-op に同期
- `src/lib/db/migrations/008_prompt_bundle_parity.sql` — no-op に同期
- `docs/DESIGNER_GUIDE.md` — パブリッシュフロー追記
- `.claude/hooks/check-stop.sh` — TICKET_ORDER を T0-T5 に修正
- `PLANS.md` — 残件プラン全チケット Green
- `tests/` — 多数の新規テスト追加（合計458テスト）

## Notes
- Final report: `PROJECT_LOG/remaining-plan-final-report.md`
- remaining_tickets_plan.md は元の入力プランとして保持
