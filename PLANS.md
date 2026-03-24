# 現在の作業: main同期後の品質整理

## ゴール
- `main` に本番反映済み変更が揃った状態で、次に片付ける品質課題だけが見えるようにする

## 進捗 (常に最新に更新)
- [x] `origin/main` と `codex/tooltip-help-front` を `main` に統合
- [x] `npm test` と `npm run build` で merge 後の基本動作を確認
- [ ] `npm run typecheck` の `.next/dev/types/*` 由来エラー原因を整理する
- [ ] `npm run lint` の既存エラーと warning の扱いを決める

## 発見・予想外のこと
- 2026-03-24: `main` は local 独自履歴と `origin/main` の更新で分岐しており、merge でないと安全に揃えにくかった
- 2026-03-24: `npm run typecheck` はアプリ本体より先に `.next/dev/types/routes.d.ts` と `.next/dev/types/validator.ts` の生成破損で落ちる
- 2026-03-24: `npm run lint` は今回触っていない既存箇所も失敗しており、少なくとも `src/app/(dashboard)/characters/[id]/phases/page.tsx` と `tutorial-video/src/DesignerTutorial.tsx` が block になっている

## 決定したこと
- 2026-03-24: 本番履歴の同期は `origin/main` merge → 作業ブランチ merge の順で行う。理由: force push を避けつつ、remote 側の更新とデプロイ済み修正を両方保持するため。
- 2026-03-24: live debug の詳細は `PROJECT_LOG/issue-0009-2026-03-24-main-sync-and-live-debug-wrapup.md` と `docs/live-debug-checklist-2026-03-24.md` に移し、PLANS は次アクション中心に戻す。理由: 次回セッションで必要な情報密度を上げるため。

## メモ
- `main` の merge 後 HEAD は `c688225`
- 次に作業するときは、まず typecheck / lint の恒常失敗を減らすと差分確認が楽になる
