# 現在の作業: Yumekano Agent MVP実装

## ゴール
デザイナーがコードを触らずにキャラを調整・テスト・公開できる、データ駆動・型安全・トレース可能なステートフル関係エージェントを実装する。

## 進捗

### 完了済み
- [x] Phase 0: Bootstrap
- [x] Phase 1: スキーマ・リポジトリ・DB
- [x] Phase 2: メモリシステム
- [x] Phase 3: 感情・プランニング
- [x] Phase 4: 生成・ランキング
- [x] Phase 5: ダッシュボード（全画面）
- [x] Phase 6: 評価システム（スコアラー7種、run_eval_suite）
- [x] 仕様書との差分実装完了
- [x] セイラキャラクター実装 & デバッグ
- [x] ワークスペース編集ページ実装（スプリットパネルUI）
- [x] フェーズ遷移条件エディタ
- [x] Git風バージョン管理システム（公開・ロールバック）
- [x] PAD編集UI不具合修正（emotion型の `baselinePAD` 対応 + API検証追加）
- [x] CoE感情変化説明UI（Playground/Workspace/Trace）実装
- [x] 処理フロー視覚化ドキュメント作成（非エンジニア向け）
- [x] LPとしてVercelにデプロイ (https://lp-gray-six.vercel.app)

### 残作業
- [ ] anchors/innerWorldをAPIレスポンスに含める
- [ ] E2Eテスト作成
- [ ] 本番デプロイ設定

## 次やること
1. anchors/innerWorldのAPI対応
2. 評価シナリオの拡充
3. 本番環境へのデプロイ準備

## 発見・予想外のこと
- 2026-03-19: トレース画面にはPAD差分があるが、感情変化の理由（appraisal寄与とplanner意図）が明示されておらず、デザイナーの都度確認コストが高かった。
- 2026-03-19: `/api/characters` が配列を返す実装に対し、一部ダッシュボード画面（Playground / Releases / Evals）が `data.characters` 前提で読み込み、キャラクターが空表示になる不整合を確認。
- 2026-03-19: `DATABASE_URL` が Supabase(PostgreSQL) のとき、DNS解決失敗 (`ENOTFOUND`) が発生すると全APIが500化し、キャラが未作成表示になることを確認。

## 決定したこと
- 2026-03-19: CoE説明は共通ロジック（`buildCoEExplanation`）で生成し、`/api/chat` と `/api/draft-chat` から毎ターン返してUI表示する。理由: Playground/Workspace/Traceで同じ説明軸を保ち、検証観点を揃えるため。
- 2026-03-19: `GET /api/characters` のレスポンスを `{ characters }` に統一する。理由: 既存ダッシュボード画面の読み込み形式と合わせ、キャラ一覧の空表示（セイラが消えたように見える）を防ぐため。
- 2026-03-19: DBクライアントに「PostgreSQL接続失敗時の `local.db` フォールバック」を実装。理由: 開発環境ネットワーク障害時でもローカル検証を継続でき、UIが空表示で詰まるのを防ぐため。

## 既知の問題
- xAI APIの応答に10-30秒かかることがある
- 食べ物の好み（イチゴタルト）がプロンプトに弱い反映

## 発見・予想外のこと
- 2026-03-19: ワークスペース感情タブのUIが旧型(`baseline`)のままで、現行スキーマ(`baselinePAD`)と不一致。感情タブ遷移時にクラッシュし、PAD編集不能になっていた。
- 2026-03-19: バックエンドの `/api/draft-chat` では PAD更新ロジック自体は正常に動作しており、問題は主にUI側のキー不一致だった。
- 2026-03-19: ワークスペース編集UIの `autonomy`/`style` が現行スキーマと不一致（`disagreementReadiness` など）で、保存後に `DraftStateSchema` パースが失敗し画面が落ちる経路を確認。
- 2026-03-19: 一部既存ドラフトが旧emotion構造（`baseline` など）を保持しており、`感情`タブ描画時の参照でランタイムエラー化するケースがあった。

## 決定したこと
- 2026-03-19: 感情UIを `baselinePAD` ベースに統一し、保存APIで `emotion` セクションに `EmotionSpecSchema` 検証を追加。理由: 再発防止（不正フォーマット保存による破損）とクラッシュ解消を同時に満たすため。
- 2026-03-19: ワークスペース保存APIで全セクションをスキーマ検証し、`workspaceRepo.getDraft` で旧キーを後方互換変換する。理由: 既存の破損ドラフトを読めるようにしつつ、新規破損の書き込みを防ぐため。
- 2026-03-19: `emotion` も後方互換正規化（旧キー→新キー + 欠損補完）を追加し、UI側にも描画ガードを入れる。理由: 既存データ由来クラッシュを即時止血し、再保存までの可用性を確保するため。

## 詳細ログ
- PROJECT_LOG/2026-03-19-version-management.md
- PROJECT_LOG/2026-03-18-seira-debug-and-editor.md
- PROJECT_LOG/2026-03-17-spec-gap-implementation.md
- PROJECT_LOG/2026-03-17-mvp-implementation.md
