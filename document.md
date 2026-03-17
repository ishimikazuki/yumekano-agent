# Yumekano Agent - プロジェクト概要

## 目的
大人向けリレーションシップチャットエージェント。長期記憶の腐敗、感情リセット、過度な同意性を防ぎ、データ駆動・型安全・トレース可能なステートフル関係エージェントを実現する。

## 技術スタック
- **フレームワーク**: Next.js 16 (App Router)
- **AI**: Mastra + AI SDK
- **データベース**: libSQL/Turso
- **言語**: TypeScript (strict: true)
- **LLM**: xAI Grok (プロバイダー交換可能)

## アーキテクチャ
```
Next.js App Router
├─ app/api/chat → Mastra workflow: chat_turn
├─ app/(dashboard) → デザイナー向けダッシュボード
├─ src/mastra
│  ├─ agents (planner, generator, ranker, memory-extractor, reflector)
│  ├─ workflows (chat-turn, consolidate-memory, run-eval-suite)
│  ├─ scorers (7種類)
│  └─ memory (retrieval, working-memory, consolidation, quality-labels)
└─ src/lib
   ├─ schemas (Zod型定義)
   ├─ repositories (データアクセス)
   ├─ rules (appraisal, PAD, phase-engine, rank-weights)
   ├─ versioning (drafts, publish, rollback)
   └─ integration (game-context-adapter)
```

## 現在のフェーズ
**MVP実装完了** - Phase 0-6全て実装済み

## 重要な決定事項
| 日付 | 決定 | 理由 |
|------|------|------|
| 2026-03-17 | MVPは1キャラのみ | スコープ限定 |
| 2026-03-17 | 直接公開（承認ワークフローなし） | MVP簡素化 |
| 2026-03-17 | xAI Grokをデフォルトプロバイダー | 構造化出力・ツール呼び出し対応 |
| 2026-03-17 | versioning機能はsrc/lib/配下 | ワークフローではなくユーティリティとして |

## 進行中の作業
PLANS.md を参照

## ログ
PROJECT_LOG/INDEX.md を参照

## 仕様書
| ファイル | 内容 |
|---------|------|
| PRD.md | 製品要件 |
| ARCHITECTURE.md | システムアーキテクチャ |
| DATA_MODEL.md | DBスキーマ |
| CHARACTER_CONFIG_SPEC.md | キャラ設定スキーマ |
| WORKFLOWS.md | chat_turnワークフロー定義 |
| REPO_STRUCTURE.md | ディレクトリ構造 |
| SCREENS.md | ダッシュボード画面仕様 |
| EVALS.md | 評価フレームワーク |
