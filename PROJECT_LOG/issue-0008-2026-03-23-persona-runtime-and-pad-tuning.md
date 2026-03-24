# persona authoring簡素化とPAD tuning

## Goal
- デザイナーが persona を軽い構造で編集できるようにしつつ、runtime では低トークンで安定した persona を使えるようにする。
- セイラの「落とし物を返してもらった」場面で PAD が不自然に不快寄りへ動く問題を止める。

## Done
- persona / workspace schema を `summary` / `innerWorldNoteMd` / `vulnerabilities` / `authoredExamples` 中心へ寄せ、旧 `innerWorld` / `surfaceLoop` / `anchors` / `topicPacks` / `reactionPacks` は `legacyAuthoring` に退避して後方互換を維持した。
- publish 時に `compiledPersona` を生成・保持できるようにし、planner / generator では prompt bundle を前置きとして残しつつ compiled persona を注入する形へ整理した。
- dashboard / repository / publish path を新しい persona 形に合わせて更新し、親密時専用 generator prompt variant も runtime と draft の両方で扱える状態に揃えた。
- `appraisal` の 0..1 系 sensitivity を中立点 `0.5` 基準で適用するよう修正し、`拾う` `届ける` `落とし物` などを goal congruence の前向きシグナルとして追加した。
- persona normalization / prompt integration / appraisal sensitivity の回帰テストを追加し、`npm test` `npm run typecheck` `npm run build` を通した。

## Discoveries
- prompt bundle を system prompt 文字列で丸ごと置き換える構成だと、動的に組み立てた persona ブロックが消え、compiled persona が runtime に反映されない。
- bounded appraisal に sensitivity を直接乗算すると、中立入力でも `controllability` や `certainty` が 0.5 未満へ沈み、「拾ってくれたのに不快寄り」の説明が出る。
- preview deploy は preview 環境変数未設定だとローカル向け `DATABASE_URL` を拾って失敗しやすく、production alias での確認が必要だった。

## Decisions
- designer-facing persona は簡素な authoring UI を優先し、runtime 向けの圧縮は publish-time compiler に寄せる。理由: 非エンジニアが触る情報量を減らしつつ、毎ターン prompt のトークンも抑えたいから。
- prompt bundle は runtime prompt の「前置き」として扱う。理由: authored instruction を保ちながら compiled persona や phase/state 文脈を必ず共存させるため。
- 0..1 appraisal sensitivity は `0.5 + (score - 0.5) * sensitivity` で適用する。理由: 感度を下げても中立がネガティブ化しないようにするため。

## Notes
- セイラの `これ落としたよ` は修正後 `goalCongruence > 0`、PAD では `pleasure` が微増し、`dominance` は下がらないことを確認した。
- push 後の deploy 確認は GitHub 連携の preview / production 設定に依存するため、環境変数未設定の preview には引き続き注意が必要。
- commit `1c75779` を `origin/codex/tooltip-help-front` へ push し、production alias `https://yumekano-codex-spec-v2.vercel.app` を更新した。
