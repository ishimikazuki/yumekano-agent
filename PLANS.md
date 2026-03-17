# 現在の作業: Yumekano Agent MVP実装

## ゴール
デザイナーがコードを触らずにキャラを調整・テスト・公開できる、データ駆動・型安全・トレース可能なステートフル関係エージェントを実装する。

## 進捗

### 完了済み（詳細は PROJECT_LOG/2026-03-17-mvp-implementation.md）
- [x] Phase 0: Bootstrap
- [x] Phase 1: スキーマ・リポジトリ・DB
- [x] Phase 2: メモリシステム
- [x] Phase 3: 感情・プランニング
- [x] Phase 4: 生成・ランキング
- [x] Playground 動作確認完了

### Phase 5: ダッシュボード - IN PROGRESS
- [x] 共通レイアウト
- [x] Playground画面
- [ ] Characters一覧画面 ← 次
- [ ] Trace Viewer画面
- [ ] Releases画面

### Phase 6: 評価システム - TODO
- [ ] スコアラー実装
- [ ] run_eval_suiteワークフロー
- [ ] シナリオパック

## 次やること
1. キャラ名「美咲」をプロンプトに明示する
2. Characters一覧画面を作成
3. Trace Viewer画面を作成
4. Releases画面を作成

## 既知の問題
- キャラ名が「さくら」と出力される（プロンプトに名前を明示する必要あり）
- xAI APIの応答に10-30秒かかることがある
