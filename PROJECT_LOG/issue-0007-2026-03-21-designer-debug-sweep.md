# デザイナー観点の総合デバッグ

## Goal
- デザイナーが触るダッシュボード全体を通しで点検し、壊れた挙動やページ遷移をその場で修正して再検証する。

## Done
- `/` を `/characters` へリダイレクトし、初期Next.jsテンプレート露出を解消した。
- 新規ワークスペース作成時に初期 draft を必ず生成し、既存の draft 欠損ワークスペースも自動修復するようにした。
- セイラのワークスペースで保存、フェーズ編集、draft chat、公開まで再検証した。
- リリースのロールバック時に新しい published version を作るよう修正し、current release と latestVersion の不整合を解消した。
- メモリ画面を実データAPI接続へ切り替え、既存ペアのメモリ表示と未作成ペアの空状態を確認した。
- 評価画面を実動化し、ローカルシナリオ読み込み、履歴表示、ケース結果表示、background 実行 + polling に対応した。
- `basic-greeting` の eval run を再実行し、`running -> completed` と結果反映を確認した。
- 全ページ共通メタデータを `Yumekano Dashboard` に更新し、`lang="ja"` を設定した。
- `/characters`, `/characters/[id]`, `/characters/[id]/phases`, `/characters/[id]/memory`, `/characters/[id]/workspace/[workspaceId]`, `/playground`, `/traces/[id]`, `/releases`, `/evals` をPlaywrightで通し確認した。

## Discoveries
- 評価実行は chat turn と scorer 群を同期待ちすると 1 リクエストが数分ぶら下がり、UI 上はハングに見える。
- メモリ画面と評価画面には stub が残っており、デザイナーが実データを確認できない状態だった。
- ロールバック実装は過去リリースを直接LIVE参照しており、バージョン履歴と画面表示が不整合になっていた。
- 新規ワークスペースでも draft が作られず、編集導線が 404 になるケースがあった。

## Decisions
- eval run API は `202 Accepted` で即時返却し、バックグラウンド実行 + polling UI にする。理由: 数分単位の同期待ちを避け、画面操作不能に見える状態を防ぐため。
- ロールバックは対象バージョンの複製から新しい published version を作ってLIVEにする。理由: 現在のリリース、バージョン履歴、画面表示を一致させるため。
- ワークスペース draft は作成時に必ず初期化し、既存の欠損データも読み込み時に救済する。理由: 編集導線を常に成立させるため。
- ダッシュボードの loading 中は empty state を出さず、明示的な loading 表示にする。理由: 「データなし」の誤認を避けるため。

## Notes
- セイラ側の現在の live version は `v3`（ロールバック生成）になっている。
- テスト用に `Misaki Debug Workspace` を1件作成した。
- `basic-greeting` の直近 eval run は平均 `86.6%` で完了した。
- `npm run typecheck` は通過した。
