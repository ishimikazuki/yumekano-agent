# main同期とlive debug wrapup

## Goal
- デプロイ済み修正を `main` に揃え、未プッシュ差分の見通しを回復する
- live production で見つかった不具合の修正内容と判断理由を、次回参照しやすい形で残す

## Done
- `codex/tooltip-help-front` 上の live debug 修正、会話 Markdown エクスポート、関連テスト、ignore 整理をコミットして push
- ローカル `main` に `origin/main` を merge し、その上に `codex/tooltip-help-front` を merge して本番向け履歴を統合
- `npm test` と `npm run build` を `main` で実行し、統合後の基本動作を確認
- `PROJECT_LOG` / `document.xml` / `PLANS.md` を wrapup 用に更新

## Discoveries
- `main` はローカル独自コミットと `origin/main` 側コミットで分岐していたため、force 系ではなく merge ベースで揃えるのが安全だった
- live Vercel の不具合は local/libsql では見えず、PostgreSQL 互換と本番 trace 書き込み経路で初めて再現するものが複数あった
- `npm run typecheck` は依然として `.next/dev/types/*` の壊れた生成物に引っ張られて失敗する
- `npm run lint` は今回の修正範囲外にも既存エラーがあり、`characters/[id]/phases/page.tsx` と `tutorial-video/src/DesignerTutorial.tsx` が block になっている

## Decisions
- `main` 同期は `origin/main` と作業ブランチを順に merge する非破壊手順を採用した
- ローカル専用生成物は `.gitignore` に寄せ、実コード差分だけが `git status` に出る状態を優先した
- live debug の詳細な再現手順と原因は `docs/live-debug-checklist-2026-03-24.md` に残し、PLANS からは次アクション中心に縮約した

## Notes
- merge 後の `main` HEAD は `c688225`、その直前に `40a8975` で `origin/main` を取り込んでいる
- 次に触るなら、まず typecheck と lint の既存失敗を片付けると運用が軽くなる
