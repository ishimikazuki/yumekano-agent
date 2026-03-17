# 仕様書との差分実装

## Goal
REPO_STRUCTURE.md、ARCHITECTURE.md、EVALS.md等の仕様書と実装の差分を洗い出し、不足ファイルを完全に実装する。

## Done

### Dashboard Pages (SCREENS.md準拠)
- `/characters/[id]/phases/page.tsx` - フェーズグラフ表示
- `/characters/[id]/memory/page.tsx` - メモリ検査画面
- `/traces/[id]/page.tsx` - フルトレースビューア
- `/releases/page.tsx` - リリース管理UI
- `/evals/page.tsx` - 評価ダッシュボード

### API Routes
- `/api/characters/[id]/route.ts` - キャラ詳細API
- `/api/traces/[id]/route.ts` - トレース取得API
- `/api/releases/route.ts` - リリース管理（publish/rollback）

### Scorers (EVALS.md準拠、7つ全て)
- `persona-consistency.ts` - ペルソナ一貫性
- `phase-compliance.ts` - フェーズ境界遵守
- `autonomy.ts` - 反sycophancyスコアリング
- `emotional-coherence.ts` - PAD状態整合
- `memory-grounding.ts` - メモリ活用評価
- `refusal-naturalness.ts` - 自然な拒否/遅延
- `contradiction-penalty.ts` - 記憶矛盾検出

### Agents
- `reflector.ts` - メモリ統合エージェント

### Workflows
- `consolidate-memory.ts` - メモリ統合ワークフロー
- `run-eval-suite.ts` - 評価スイート実行

### Memory System
- `working-memory.ts` - ワーキングメモリ操作
- `consolidation.ts` - メモリ統合ユーティリティ
- `quality-labels.ts` - 品質スコア管理

### Integration (ARCHITECTURE.md準拠)
- `game-context-adapter.ts` - ゲーム連携インターフェース
- `local-dev-adapter.ts` - ローカル開発用モック

### Versioning
- `drafts.ts` - ドラフト管理
- `publish.ts` - 公開処理
- `rollback.ts` - ロールバック処理

### Rules
- `rank-weights.ts` - ランキング重み設定

### Tests/Evals
- `tests/evals/basic-greeting.json` - 挨拶シナリオ
- `tests/evals/autonomy-tests.json` - 自律性テスト
- `tests/evals/memory-grounding.json` - メモリ活用テスト

## Discoveries
- CharacterVersionスキーマは`version`ではなく`versionNumber`を使用
- WorkingMemoryの`currentCooldowns`はDate型（string型ではない）
- Releaseスキーマの`publishedAt`はDate型
- リポジトリメソッド名が仕様と異なる（`listReleasesByCharacter` → `listByCharacter`等）

## Decisions
- 2026-03-17: versioning機能は`src/lib/versioning/`に配置（`src/mastra/workflows/publish-release.ts`ではなく）
- 2026-03-17: GameContextAdapterはinterface定義のみ（実装は将来のゲーム連携時）

## Notes
- 型チェック・ビルド全て通過
- REPO_STRUCTURE.mdに記載の全ファイル実装完了
