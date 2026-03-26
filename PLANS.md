# 現在の作業: main同期後の品質整理

## ゴール
- `main` に本番反映済み変更が揃った状態で、次に片付ける品質課題だけが見えるようにする

## 進捗 (常に最新に更新)
- [x] `origin/main` と `codex/tooltip-help-front` を `main` に統合
- [x] `npm test` と `npm run build` で merge 後の基本動作を確認
- [x] ダッシュボード入力欄の文字色を `black` に統一
- [ ] `npm run typecheck` の `.next/dev/types/*` 由来エラー原因を整理する
- [ ] `npm run lint` の既存エラーと warning の扱いを決める

## 発見・予想外のこと
- 2026-03-24: `main` は local 独自履歴と `origin/main` の更新で分岐しており、merge でないと安全に揃えにくかった
- 2026-03-24: `npm run typecheck` はアプリ本体より先に `.next/dev/types/routes.d.ts` と `.next/dev/types/validator.ts` の生成破損で落ちる
- 2026-03-24: `npm run lint` は今回触っていない既存箇所も失敗しており、少なくとも `src/app/(dashboard)/characters/[id]/phases/page.tsx` と `tutorial-video/src/DesignerTutorial.tsx` が block になっている
- 2026-03-24: 入力UIは複数ページに散っていたが、`globals.css` で `input` / `textarea` / `select` の文字色をまとめて指定するほうが差分が小さく再利用部品にも効く

## 決定したこと
- 2026-03-24: 本番履歴の同期は `origin/main` merge → 作業ブランチ merge の順で行う。理由: force push を避けつつ、remote 側の更新とデプロイ済み修正を両方保持するため。
- 2026-03-24: live debug の詳細は `PROJECT_LOG/issue-0009-2026-03-24-main-sync-and-live-debug-wrapup.md` と `docs/live-debug-checklist-2026-03-24.md` に移し、PLANS は次アクション中心に戻す。理由: 次回セッションで必要な情報密度を上げるため。
- 2026-03-24: 今回の入力文字色変更は各画面の className 個別修正ではなくグローバルCSSで適用する。理由: 入力部品が複数あり、最小差分で漏れなく反映できるため。

## メモ
- `main` の merge 後 HEAD は `c688225`
- 次に作業するときは、まず typecheck / lint の恒常失敗を減らすと差分確認が楽になる

---

## 並行タスク: emotion/relationship regression harness

### ゴール
- runtime変更前に CoE / PAD / pair-state progression の期待挙動を failing test で固定する

### 進捗 (常に最新に更新)
- [x] 既存の appraisal / PAD / CoE / relationship update の seam を確認
- [x] 10ケース fixture と focused test command を追加する
- [x] failing cases report をまとめる

### 発見・予想外のこと
- 2026-03-25: 感情更新は `computeAppraisal` → `updatePAD` → `buildCoEExplanation` → `updateRelationshipMetrics` の pure 関数列で再現できるため、本番コードを変えずに regression harness を組める
- 2026-03-25: 現在の `npm test` は `tests/*.test.ts` のみ対象で、`tests/regression` 配下に focused harness を isolated に追加できる
- 2026-03-25: baseline 実行では 10 ケース中 9 ケースが fail し、特に compliment / apology / safe intimacy / multi-turn progression が弱く、boundary violation では `normAlignment` が理由に現れない

### 決定したこと
- 2026-03-25: 新しい回帰ハーネスは `tests/regression` 配下に置き、`npm run test:emotion-regression` で実行する。理由: 既存スイートの signal を崩さず、runtime 変更前の期待挙動だけを明示的に赤く保つため。
- 2026-03-25: baseline report は markdown として repo に残す。理由: runtime 調整前後で「どのケースが、なぜ落ちているか」を diff しやすくするため。

### メモ
- compliment / apology / boundary / carry-over / 5-turn progression を fixture で固定する

---

## 並行タスク: model-driven CoE Evidence Extractor

### ゴール
- pattern matching 依存を減らすため、structured evidence extraction 用の emotion/coE agent module を追加する

### 進捗 (常に最新に更新)
- [x] 既存 agent/provider と emotion contract schema の接続点を確認
- [x] extractor module と structured output schema を追加する
- [x] mocked tests で retry/validation を固定する

### 発見・予想外のこと
- 2026-03-25: production wiring を触らなくても、独立 agent module と strict parser を追加すれば semantic analysis path の future seam を作れる
- 2026-03-25: retry は provider 側 schema strictness に任せるより、raw object を受けて自前 parser で検証したほうが malformed output を deterministic に再試行しやすい

### 決定したこと
- 2026-03-25: 新 extractor は `analysisMedium` を再利用し、専用 model role はまだ増やさない。理由: production diff を広げず、agent module と contract を先に固定するため。

---

## 並行タスク: deterministic CoE PAD / pair-state integrator

### ゴール
- CoE relational appraisal から PAD と pair-state を deterministic に更新しつつ、旧 heuristic path と feature flag で比較できる状態にする

### 進捗 (常に最新に更新)
- [x] emotion schema に `coeIntegrator` config default を追加し、既存 `EmotionSpec` 利用箇所へ backfill を入れる
- [x] CoE relational appraisal を入力にする deterministic integrator を追加する
- [x] workflow に feature flag 分岐を追加して旧 path を残す
- [x] guardrail / decay / carry-over / open-thread bias の unit test を追加する

### 発見・予想外のこと
- 2026-03-25: pair metric の inertia を単純な edge-room べき乗でかけると、repair 時の conflict 低下や pressure 時の intimacy 抑制まで鈍りすぎた
- 2026-03-25: quiet turn の PAD 減衰は効いているが、期待値は厳密な単一点より band で置いたほうが recovery half-life 調整に耐える

### 決定したこと
- 2026-03-25: production ではまだ `computeAppraisal` を残し、新 integrator には `adaptLegacyAppraisalToRelationalAppraisal` を噛ませて入れる。理由: semantic extractor の本番配線前でも state update path だけ比較できるようにするため。
- 2026-03-25: abuse / consent 系は full semantic parser ではなく小さい deterministic guardrail override として separte layer に置く。理由: semantic 主経路を regex に戻さず、危険側だけ明示 override したいため。
- 2026-03-25: pair metric inertia は「edge に近づくほど減衰するが、中域では十分動く」形にする。理由: repair/pressure の回復・悪化が不自然に鈍らないようにするため。

---

## 並行タスク: production chat_turn への CoE pipeline 配線

### ゴール
- production chat_turn で CoE evidence extraction -> relational appraisal -> deterministic integrator を本番 state update 経路として使う

### 進捗 (常に最新に更新)
- [x] executeTurn を model CoE pipeline ベースに切り替える
- [x] planner / generator / ranker に CoE evidence と relational appraisal を渡す
- [x] trace / DB schema を拡張して evidence, emotionTrace, legacyComparison を保存する
- [x] one-turn / three-turn の integration test を追加する

### 発見・予想外のこと
- 2026-03-25: pairState や CoE explanation, scorer 側はまだ `AppraisalVector` を参照しているため、new path の本番化には relational appraisal からの compatibility adapter が必要だった
- 2026-03-25: old/new comparison を trace に残したい場合、integrator flag ではなく「legacy heuristic を comparison-only で追加計算する flag」として扱うほうが差分比較しやすい

### 決定したこと
- 2026-03-25: production path は常に model CoE -> integrator を使い、legacy heuristic は flag 時のみ comparison trace として計算する。理由: 本番更新ロジックを一本化しつつ rollback 観測を残すため。
- 2026-03-25: UI inspect 用の新データは `TurnTrace` に `coeExtraction`, `emotionTrace`, `legacyComparison` を足して保存する。理由: planner/generator/ranker の説明可能性と old/new diff を同じ trace で見たいから。

---

## 並行タスク: sandbox / playground state carry-over

### ゴール
- draft/playground chat が production と同じ CoE state update path を使いながら、session 単位で PAD / pair state / open threads / phase / working memory を持ち越す

### 進捗 (常に最新に更新)
- [x] sandbox 側の state persistence と UI restore/reset 経路を確認
- [x] session 未指定時に最新 sandbox session を再利用する server path を追加
- [x] 明示 reset で sandbox session state を削除する API と UI 導線を追加
- [x] multi-turn carry-over / reset 後 baseline 復帰の integration test を追加する

### 発見・予想外のこと
- 2026-03-26: `runDraftChatTurn` 自体はすでに production の `executeTurn` を再利用していて、state が baseline に戻る主因は workflow ではなく「session を見失うと毎回新規 session を作ること」だった
- 2026-03-26: workspace sandbox は editor context から session 復元できるが、共通 playground 画面は最新 sandbox session を復元しておらず、ページ再訪で会話履歴も state continuity も見えなくなっていた
- 2026-03-26: reset は UI で local state を消すだけで、sandbox 側の pair state / memory / open threads は残っていた

### 決定したこと
- 2026-03-26: sessionId が未指定でも `workspaceId + userId` の最新 sandbox session を再利用する。理由: baseline への暗黙リセットをなくし、sandbox を production と同じ「pair/session continuity」前提に寄せるため。
- 2026-03-26: reset は explicit action として session 配下の sandbox state を削除する。理由: continuation を既定動作にしつつ、テストと UI からだけ明示的に baseline に戻せるようにするため。
- 2026-03-26: 共通 playground の復元は editor-context 依存にせず `userId` fallback も持たせる。理由: draft workspace 以外の sandbox surface でも同じ session continuity を保証したいため。

---

## 並行タスク: canonical prompt bundle consolidation

### ゴール
- planner / generator / generatorIntimacy / ranker / emotion appraiser の prompt を、schema・storage・seed・runtime load・draft edit で同じ canonical bundle shape に揃える

### 進捗 (常に最新に更新)
- [x] prompt bundle の canonical schema / helper を `prompts.ts` に集約する
- [x] workspace draft / published prompt bundle / seed の保存経路を同じ shape に揃える
- [x] `emotionAppraiserMd` の互換 migration と legacy backfill を追加する
- [x] round-trip persistence test を追加する

### 発見・予想外のこと
- 2026-03-26: prompt field 定義は `workspace.ts` と published prompt schema の両方に散っていて、`generatorIntimacyMd` は保存されていても canonical helper がなく、`emotionAppraiserMd` は bundle 側の永続化列自体が欠けていた
- 2026-03-26: 既存 draft / prompt bundle を壊さないには、schema に optional を増やすだけでは足りず、DB column default と load-time backfill を両方入れる必要があった

### 決定したこと
- 2026-03-26: `src/lib/schemas/prompts.ts` を prompt bundle の唯一の source-of-truth にし、`PromptBundleContentSchema` / `buildPromptBundleContent` / `buildPromptBundleVersion` を各層から再利用する。理由: schema と runtime mapping の二重管理をなくして field drift を止めるため。
- 2026-03-26: `emotionAppraiserMd` は将来の model appraisal path 用 prompt として canonical bundle に含めるが、runtime behavior はこのタスクでは変えない。理由: prompt source-of-truth を先に揃えつつ、production logic の配線変更は別差分に分離するため。

---

## 並行タスク: deterministic ranker gates と final eval

### ゴール
- model ranker の前に deterministic gate を置いて safety / phase / CoE / memory contradiction を先に落とし、emotion/relationship eval の最終状態を可視化する

### 進捗 (常に最新に更新)
- [x] ranker に deterministic pre-gates を追加する
- [x] runtime phase mode に合わせて rank weight mapping を補正する
- [x] gate regression unit test を追加する
- [x] deterministic regression harness と live emotion/relationship eval を実行する

### 発見・予想外のこと
- 2026-03-26: 既存 ranker の phase weight mapping は `entry/relationship/girlfriend` を拾えておらず、実質ほぼ常に default weights になっていた
- 2026-03-26: live emotion/relationship eval は ranker 以前に CoE evidence extractor の malformed span で全件停止し、現在の最大 blocker が ranker ではなく extractor schema robustness だと分かった
- 2026-03-26: regression harness は引き続き 10 ケース中 9 ケース fail で、特に compliment / apology / safe intimacy / carry-over 系の state lift が弱い

### 決定したこと
- 2026-03-26: deterministic gate は ranker 内に留め、hard safety / phase / CoE contradiction / memory contradiction を順に評価する。理由: ranker 前段の guard を強めつつ、planner/generator の構造を広げないため。
- 2026-03-26: live eval は fresh migration ではなく `local.db` の temp copy から実行する。理由: 現行 migration SQL が空の libSQL file で崩れるため、開発 seed 状態を隔離複製して評価したほうが今回の目的に合うため。
- 2026-03-26: `YUMEKANO_USE_COE_INTEGRATOR` は引き続き default off を推奨する。理由: いまの failure は比較 trace の有無より、live extractor robustness と emotion progression の弱さが先に解消対象だから。
