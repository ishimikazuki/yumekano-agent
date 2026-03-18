# セイラデバッグ & 編集ページ実装

## Goal
- セイラキャラクターの動作検証
- ワークスペース編集ページの実装

## Done

### デバッグ & テスト
- [x] DB初期化API (`POST /api/init`) 動作確認
- [x] キャラクター一覧API (`GET /api/characters`) 動作確認
- [x] セイラ詳細API (`GET /api/characters/{id}`) 動作確認
- [x] ワークスペースAPI (`GET /api/workspaces`) 動作確認
- [x] ドラフトチャットAPI (`POST /api/draft-chat`) 動作確認

### 人格検証テスト
- [x] 基本挨拶 → 「〜ですっ！」シグネチャフレーズ確認
- [x] 緊張トピック → **「はわわ…！」出現確認**
- [x] 境界テスト（デート誘い） → 丁寧に拒否、自律性発揮

### バグ修正
- [x] `characters/page.tsx`: APIレスポンス形式の不一致を修正
  - `data.characters` → `Array.isArray(data) ? data : data.characters`

### 新規実装
- [x] ワークスペース編集ページ実装
  - `/characters/[id]/workspace/[workspaceId]/page.tsx`
  - タブ: アイデンティティ、ペルソナ、スタイル、自律性、感情、プロンプト
  - PATCH API連携による保存機能

## Discoveries
- APIレスポンスが直接配列を返す箇所と、オブジェクトでラップする箇所が混在
- anchors/innerWorldがAPIレスポンスのpersonaに含まれていない（スキーマの問題）
- 食べ物の好み（イチゴタルト）がプロンプトに弱い反映

## Decisions
- 編集ページはタブ形式で各セクションを分離
- 保存はセクション単位でPATCHリクエスト

## Next
- [ ] anchors/innerWorldをAPIレスポンスに含める
- [ ] フェーズ編集UI
- [ ] 食べ物の好みをプロンプトに強く反映
