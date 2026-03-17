# Yumekano Agent MVP Implementation

## Goal
- Phase 0-4 の実装（Bootstrap → スキーマ → メモリ → 感情・プランニング → 生成・ランキング）
- Playground でサンドボックスチャットができる状態

## Done

### Phase 0: Bootstrap
- Next.js App Router プロジェクト作成
- @mastra/core, @libsql/client, @ai-sdk/xai インストール
- TypeScript strict: true 確認
- プロバイダーレジストリ設定（xAI Grok）

### Phase 1: スキーマ・リポジトリ・DB
- 全 Zod スキーマ定義（8ファイル）
  - character, phase, memory, plan, trace, prompts, release, eval
- DB マイグレーション作成（001_initial.sql）
- リポジトリ層実装（8つ）
  - character, pair, memory, trace, release, eval, phase-graph, prompt-bundle

### Phase 2: メモリシステム
- WorkingMemory 管理
- エピソード記録（memory_events）
- グラフ知識（memory_facts with supersession）
- 観察ブロック（memory_observations）
- 未解決スレッド（memory_open_threads）
- 5段階検索パイプライン

### Phase 3: 感情・プランニング
- アプレイザル計算（9次元）
- PAD 状態遷移（fast affect + slow mood）
- Planner エージェント
- PhaseEngine（フェーズ遷移判定）

### Phase 4: 生成・ランキング
- Generator エージェント（3-5候補生成）
- Ranker エージェント（6次元スコアリング）
- MemoryExtractor エージェント
- chat_turn ワークフロー統合（10ステップ）

### Phase 5: ダッシュボード（部分）
- 共通レイアウト（ナビゲーション）
- Playground 画面（チャット UI）
- API routes（/api/chat, /api/init, /api/characters）

### シードキャラクター
- 「美咲（Misaki）」を作成
- 4フェーズのグラフ（first_meeting → getting_closer → dating → established）

## Discoveries
- create-next-app は既存ファイルがあるディレクトリでは動作しないため、一時ディレクトリからコピーした
- Next.js API route ではファイルシステムアクセスが制限されるため、マイグレーション SQL を直接埋め込む必要があった
- SQL コメント行の処理が不完全で、マイグレーションが途中で失敗した → コメント除去ロジックを改善

## Decisions
- 仕様書ディレクトリ内で Next.js プロジェクトを直接作成
- MVP 初期キャラクターとして「美咲」を作成
- メモリ検索の MVP はキーワードベース（将来的に embedding 対応）

## Notes
- xAI API の応答に 10-30 秒かかることがある
- キャラ名が「さくら」と出力される問題あり（プロンプトに名前を明示する必要あり）
- PAD 感情システムは正常に動作（会話に応じて値が変化）
