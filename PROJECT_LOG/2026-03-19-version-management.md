# Git風バージョン管理システム実装

## Goal
デザイナーがキャラクターのバージョンをGit風に管理できるようにする：
- ワークスペースで編集 → 名前付きバージョンとして公開
- バージョン履歴の閲覧
- 任意のバージョンへのロールバック

## Done

### API実装
- `GET /api/characters/[id]/versions` - バージョン履歴取得
- `POST /api/workspaces/[id]/publish` - ドラフトを新バージョンとして公開
- `POST /api/characters/[id]/versions/[versionId]/rollback` - 特定バージョンにロールバック

### DBスキーマ拡張
- `character_versions` テーブルに追加:
  - `label` (TEXT) - 人間が読めるバージョン名（例: "口癖調整版"）
  - `parent_version_id` (TEXT) - 派生元バージョンID

### UI実装
- ワークスペースエディタに「バージョン」タブ追加
- 公開ダイアログ（バージョン名入力）
- バージョン履歴リスト（公開中/アーカイブ状態、派生元表示）
- ロールバックボタン（確認ダイアログ付き）

## Discoveries
- ロールバックは「過去バージョンの内容で新バージョンを作成」するGit的なアプローチが直感的
- parentVersionIdで派生関係を追跡することで、履歴のツリー構造が見える

## Decisions
- **2026-03-19**: ロールバックは破壊的操作ではなく、新バージョン作成として実装
- **2026-03-19**: バージョンステータスは draft/published/archived の3状態
- **2026-03-19**: 公開時に古いpublishedバージョンは自動でarchivedに移行

## Notes
- デバッグループで全機能の動作確認済み
- v1→v2→v3→v4→v5 のフローをテスト完了
- UIのレスポンスは良好
