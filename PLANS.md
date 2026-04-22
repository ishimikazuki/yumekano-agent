# 現在の作業: なし（前セッションの T0–T6 最適化 + T-A..T-E 会話深化は PR #1 で main merge 済）

## ゴール
- _次の作業が決まったらここに書く_

## 進捗
- [x] T0–T6 latency 最適化（alias split / fast tier / hot-path offload / operational profiles）
- [x] T-A / T-B / T-C / T-D / T-E 会話深化（self_disclose / vulnerabilitySignal / question-saturation / push-pull prompt / seira persona tuning）
- [x] PR #1 main merge（commit `41ef1e3`、feature branch 削除済み）
- [x] セッション wrapup（PROJECT_LOG/issue-0018 に記録、document.xml 更新）

## 次に検討する候補（必要になったら着手）
- [ ] prod DB の seira を新 persona に republish: `DATABASE_URL=<prod> npx tsx src/scripts/republish-seira.ts`
- [ ] live A/B ablation 基盤整備（decision stack tier lowering の評価に必要）
- [ ] `src/app/api/debug-columns/` の扱い（本番運用で不要なら削除 or `.gitignore` 追加）
- [ ] PLANS.md で deferred 扱いの T-A / T-B / T-D は本セッションで完了済み。PLANS.md 上の "Deferred" 記述は歴史的経緯として残すか、削除するか判断

## 発見・予想外のこと
- 2026-04-22: `start-ticket.py` の next_section_re が numeric ticket しか境界認識しなかったため、複数 stream parallel 時に acceptance 吸い込み事故が起きていた。regex 1 行で修正。
- 2026-04-22: offline eval (YUMEKANO_EVAL_MODE=offline) は fixture-based で LLM を呼ばないため decision stack の live ablation は本 repo では不可能。T5 は honest に "held" で確定。
- 2026-04-22: schema 拡張で `.default(0)` vs `.optional()` の選択が既存 fixtures の型影響を決める。`.optional()` + `?? 0` fallback で多数の機械的修正を回避。

## 決定したこと
- 2026-04-22: POC default = `poc_balanced_latency`。quality-first は rollback profile として温存。
- 2026-04-22: decision stack tier lowering は live A/B evidence なしには変更しない。env var override (`STRUCTURED_POSTTURN_MODEL` / `MAINTENANCE_MODEL`) は operator experimentation 用。
- 2026-04-22: squash merge（main 既存 commit 履歴形式に合わせる）。

## メモ
- commit `41ef1e3` が T0–T6 + T-A..T-E をまとめた main 反映済みの 1 point-in-time スナップショット。
- ci:local all green、typecheck clean、emotion regression 91/91、eval:smoke 10/10。
