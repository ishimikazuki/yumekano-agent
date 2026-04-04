# PLAN.md チケットループ T0-T4 テスト整備

## Goal
- PLAN.md (T0-T9) の受入基準に対応するテストファイルを、指定されたファイル名・ディレクトリ構成で整備する
- チケットループ (start-ticket → テスト → 実装 → レビュー → 完了) を正式に運用する

## Done

### インフラ整備
- PLANS.md を PLAN.md のチケット体系 (T0-T9) に書き換え
- `start-ticket.py` がパース可能な形式で受入基準・必要テストを記述
- `.backup` ファイル 8件を削除

### T0: ローカル品質ゲートの新設
- `tests/db/fresh-db.migrate-smoke.test.ts` (3テスト)
- `tests/db/fresh-db.seed-smoke.test.ts` (4テスト)
- `tests/workflow/chat-turn.smoke.test.ts` (6テスト)
- `package.json` の `test:db`, `test:workflow` を新ファイルも含むよう更新

### T1: generatorIntimacyMd persistence contract
- `tests/contracts/prompt-bundle.generator-intimacy.contract.test.ts` (3テスト)
- `tests/contracts/workspace-draft.generator-intimacy.contract.test.ts` (3テスト)
- `tests/db/fresh-db.workspace-prompt-contract.test.ts` (2テスト)

### T2: prompt contract canonical source
- `tests/contracts/planner-prompt.contract.test.ts` (3テスト)
- `tests/contracts/generator-prompt.contract.test.ts` (3テスト)
- `tests/contracts/ranker-prompt.contract.test.ts` (3テスト)
- `tests/contracts/seed-prompt.contract.test.ts` (3テスト)
- `tests/contracts/prompt-override.behavior.test.ts` (5テスト)

### T3: CoE 契約と回帰フィクスチャ
- `tests/contracts/coe-schemas.contract.test.ts` (6テスト)
- `tests/evals/emotion/` 11 fixture files (91テスト合計)
- 共通ランナー `tests/evals/emotion/_fixture-runner.ts`

### T4: CoE extractor と pure integrator
- `tests/unit/coe-extractor.mocked.test.ts` (3テスト)
- `tests/unit/coe-extractor.parse-repair.test.ts` (2テスト)
- 6 integrator scenario tests (6テスト)
- 共通ヘルパー `tests/unit/_integrator-helpers.ts`

### 旧 PLANS.md バグ修正チケット (T0-T3) も完了
- JSON.parse 安全性修正、as any 除去、tsc 0エラー化
- テスト型エラー修正 (16→0)
- Shadow report legacy除去注記追加

## Discoveries
- 2026-04-03: PLAN.md指定のテストファイルが1つも存在しなかった。機能は実装済みだが別ファイル名でテストされていた
- 2026-04-03: サブエージェントに研究だけ任せたつもりがコード変更・コミットまでしてしまった。明示的に「変更するな」と指示が必要
- 2026-04-03: `promptBundleRepo.create` は `{ characterId, prompts }` 形式。フラット引数ではない

## Decisions
- 2026-04-03: PLAN.md のチケット体系を正式採用。PLANS.md を PLAN.md 形式で管理
- 2026-04-03: 既存テストは残しつつ、PLAN.md指定のファイル名で新規テストを作成する方針

## Notes
- T5-T9 は次セッションで対応
- テスト総数: 元159件 → 大幅増加（各チケットで新規テスト追加）
- tsc --noEmit: 0エラー
- eval:smoke: 10/10
- ci:local: green
