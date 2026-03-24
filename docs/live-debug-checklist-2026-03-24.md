# Live Debug Checklist — 2026-03-24

対象: `https://yumekano-codex-spec-v2.vercel.app`

## 目的
- デザイナー導線の主要画面が live で読めること
- 主要な書き込み経路が環境差分で落ちないこと
- trace / eval / sandbox の運用導線が再現可能であること

## チェック項目

### A. ナビゲーションと read-only 画面
- [x] `/characters` が表示され、character card が並ぶ
- [x] `/characters/:id` が表示され、overview が崩れない
- [x] `/characters/:id/memory?userId=test-user-1` が実メモリを返す
- [x] `/characters/:id/memory` が events / facts / threads 件数を描画する
- [x] `/evals` が current version / scenario sets / scorer list を描画する
- [x] `/releases` が current release / history を描画する
- [x] `/characters/:id/workspace/:workspaceId` が split editor を表示する

### B. 会話導線
- [x] `/playground` production で UI 送信が通る
- [x] production `/api/chat` が `text / traceId / phaseId / emotion / coe` を返す
- [x] trace link から `/traces/:id` が表示できる
- [x] `/playground?workspaceId=...` sandbox で UI 送信が通る
- [x] sandbox `/api/draft-chat` が `text / sessionId / turnId / phaseId / emotion / coe / trace` を返す

### C. 評価導線
- [x] eval run POST が `202` 相当の pending run を返す
- [x] UI が running 状態を表示する
- [x] active eval run が同一 version で二重起動しない

### D. 環境差分の確認
- [x] Postgres で SQLite 方言 SQL が混ざっていない
- [x] trace API のレスポンス shape が UI と一致する

## Browser Use CLI 実施メモ
- `browser-use install`
- `browser-use --session live-debug open https://yumekano-codex-spec-v2.vercel.app`
- `browser-use --session live-debug state`
- `browser-use --session live-debug screenshot /tmp/*.png --full`
- `browser-use --session live-debug input <index> ...`
- `browser-use --session live-debug keys Enter`
- `browser-use --session live-debug click <index>`

## 実地結果

### 確認できた正常系
- characters / detail / memory / evals / releases / workspace editor / trace viewer は live で表示できた
- production `/api/chat` は正常応答した
- production playground UI からも送信でき、trace リンクを開けた

### 再現した不具合
1. `sandbox draft-chat` が live で 500
   - 再現: `/playground?workspaceId=80c9b57b-09b2-4c03-8336-fc90875371ca`
   - 症状: `{"error":"syntax error at or near \"OR\""}` を返す
   - 原因: `workspaceRepo.saveSandboxPairState()` と `saveEditorContext()` に `INSERT OR REPLACE` が残っていて Postgres 互換でない

2. `eval run` が同一 version で二重起動
   - 再現: `Basic Greeting` をほぼ同時に UI と API から起動
   - 症状: `running` が2件作成された
   - 原因: `existingRun` の read-before-write だけで排他しており、DB 制約がなかった

## 対応済み修正
- `workspace_editor_context` / `sandbox_pair_state` を `ON CONFLICT` upsert に変更
- `eval_runs(character_version_id)` に active run 用 partial unique index を追加
- eval POST で unique conflict を 409 + existing run に変換

## 残留リスク
- live site へはまだ未デプロイなので、上の不具合は現在の本番には残っている
- eval は今回 duplicate run を実際に作っているので、履歴上は2件の running/completed が残る可能性がある

## 再デプロイ後 rerun

### 追加で再現した不具合
1. `GET /api/evals` が 500
   - 症状: `emotion.appraisalSensitivity.selfRelevance` 欠損で Zod parse error
   - 原因: published character version 読み込みで legacy emotion normalization が未適用

2. production `/api/chat` が 500
   - 症状1: `INSERT has more target columns than expressions`
   - 原因1: `traceRepo.createTrace()` の `turn_traces` INSERT で placeholder が 1 つ足りなかった
   - 症状2: `multiple assignments to same column "pad_json"`
   - 原因2: `pairRepo.updateState()` が `emotion` と `pad` の両方から `pad_json` を更新していた

3. Browser Use CLI の fresh session 起動が不安定
   - 症状: `BrowserStartEvent ... timed out after 30.0s`
   - 原因: Browser Use 側の session watchdog。site 自体の 500 ではない

### 再対応後の確認
- [x] production alias `https://yumekano-codex-spec-v2.vercel.app` に再デプロイ済み
- [x] `GET /api/evals?characterId=fc81763c-0ac7-4860-b46d-635b8b0c74cc` が 200
- [x] `POST /api/evals` は active run 存在時に 409 相当 JSON を返す
- [x] `POST /api/chat` が `text / traceId / phaseId / emotion / coe / emotionState*` を返す
- [x] `POST /api/draft-chat` が `text / sessionId / turnId / phaseId / emotion / coe / trace` を返す
- [x] Browser Use CLI で `characters / detail / memory / releases / evals / workspace editor / playground(prod/sandbox)` の再読込を確認

### Browser Use 再実地メモ
- 既存 session 再利用ではページ遷移・state 取得は安定した
- prod/sandbox playground の UI 送信は `考え中...` 状態までは確認できた
- 同タイミングの API 直叩きは prod/sandbox とも成功したため、live backend は正常
- UI の返答本文確認は Browser Use session の pending 状態と watchdog 制約に引っ張られ、今回は API 応答で代替確認した
