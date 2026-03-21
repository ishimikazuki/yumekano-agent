# 処理フロー視覚化ドキュメント作成 & LPデプロイ

## Goal
非エンジニア向けに、Yumekano Agentの処理フローを分かりやすく視覚化した図解を作成する

## Done

### 1. 仕様書の確認
- WORKFLOWS.md, ARCHITECTURE.md, CHARACTER_CONFIG_SPEC.md を読み込み
- 10ステップの処理フロー、設定項目の影響、感情システム、記憶構造、段階遷移を整理

### 2. FigJam図の作成（Mermaid記法）
- 会話処理フロー（10ステップ）
- 設定項目の影響マップ
- 感情システムの流れ
- 記憶の5層構造
- 関係性の段階遷移

### 3. HTML/CSS視覚ガイドの作成
- `docs/processing-flow-visual.html` を作成
- 初版：詳細すぎて分かりにくいとフィードバック
- 改善版：Mermaidの良さ（シンプルなフロー）を活かしつつ、より分かりやすく

### 4. frontend-designスキルを活用
- デザイン原則を学び、教科書スタイル + ソフトカラーパレットを採用
- 各セクションを独立カードに分離、間隔を広げて明確化

### 5. 最終版の改善ポイント
- 感情システム：具体例（「かわいいね」→「照れた返事」）を追加
- 設定項目：「反論しやすさ↑ → もっとツンデレに」のように効果を明示
- 記憶構造：層間の変換処理（「重要な部分を抽出」等）を矢印で表現
- 段階遷移：各段階で「できること/できないこと」を明示

### 6. LPとしてVercelにデプロイ
- `docs/lp/index.html` として配置
- URL: https://lp-gray-six.vercel.app

## Discoveries
- Mermaidのシンプルさ（フロー図としての分かりやすさ）は価値がある
- HTML/CSSで自由に作れるからといって情報を詰め込みすぎると逆効果
- 非エンジニア向けには「具体例」が理解を助ける
- 「何を変えると何が変わるか」を明示することが設定理解の鍵

## Decisions
- 視覚化ドキュメントは `docs/processing-flow-visual.html` に配置
- LPは `docs/lp/` ディレクトリで独立管理
- Vercelで静的サイトとしてデプロイ

## Files Created/Modified
- `docs/processing-flow-visual.html` - 処理フロー視覚化ガイド
- `docs/lp/index.html` - LP用コピー
- `docs/PROCESSING_FLOW_GUIDE.md` - テキスト版ガイド（初期版）

## Notes
- LPのURL: https://lp-gray-six.vercel.app
- FigJam図も作成済み（Mermaid記法ベース）
