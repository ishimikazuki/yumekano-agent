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

### 残作業
- [ ] anchors/innerWorldをAPIレスポンスに含める
- [ ] E2Eテスト作成
- [ ] 本番デプロイ設定

## 次やること
1. anchors/innerWorldのAPI対応
2. 評価シナリオの拡充
3. 本番環境へのデプロイ準備

## 既知の問題
- xAI APIの応答に10-30秒かかることがある
- 食べ物の好み（イチゴタルト）がプロンプトに弱い反映

## 詳細ログ
- PROJECT_LOG/2026-03-19-version-management.md
- PROJECT_LOG/2026-03-18-seira-debug-and-editor.md
- PROJECT_LOG/2026-03-17-spec-gap-implementation.md
- PROJECT_LOG/2026-03-17-mvp-implementation.md
