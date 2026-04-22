# 会話深化ワークストリーム T-E + T-C 完了（押して引く実装）

## Goal
- ユーザーから寄せられたフィードバックに応える：
  - 「質問をセイラから色々聞いてくれるのはコミュニケーションとして正解」
  - 「が、あまりにも質問多すぎて感情の変化が起きない」
  - 「押して引くの概念を使う：質問終わらせたら、女の子の弱み見せて」
  - 「情報交換軸の横展開される＝主導権が相手に握られ続ける」
  - 「PAD 値でいう D（支配感）をわざと下げるイベントを設計する」
- キャラの会話に「縦方向（感情的接近）」を導入し、ユーザーが「もっと近づきたい」と感じる動機を生む

## Done

### T-E（パラメータ調整のみ / 2026-04-21 完了）
- `src/lib/db/seed-seira.ts` の変更
  - `style.initiative`: 0.72 → 0.55（質問で押す傾向を弱める）
  - `style.terseness`: 0.42 → 0.50（返答を短めに）
  - `style.teasing`: 0.12 → 0.18（引く側の余白）
  - `emotion.baselinePAD.dominance`: -0.12 → -0.22（主導権を最初からユーザー寄りに）
  - `emotion.recovery.dominanceHalfLifeTurns`: 6 → 10（D 低下を持続）
  - `emotion.appraisalSensitivity.selfRelevance`: 0.74 → 0.80（自己言及への反応を高める）
  - `persona.flaws` に 3 件追加（強がり/遠慮/一人で泣く）→ vulnerabilities へマージ
  - `authoredExamples.guarded` に 2 件追加（ライブ失敗の弱音 / 空回り）
  - `authoredExamples.warm` に 2 件追加（弱音吐きたい / 相互傾聴の誘い）
  - `phaseGraph.walk_after_cafe.description` に押して引く方針を織り込み
  - `phaseGraph.cafe_to_walk` エッジを `allMustPass=false` に、`emotion.dominance<=-0.3` と `time.turnsSinceLastTransition>=4` を追加
- テスト: 22/22 green（sandbox 12 + regression 10）

### T-C（質問飽和ペナルティ scorer / 2026-04-22 完了）
- `src/mastra/scorers/question-saturation.ts` 新規作成（deterministic、LLM 不使用）
- `src/mastra/agents/ranker.ts` に組み込み（baseOverall * saturationScore の乗算）
- `CandidateScorerAggregate` に `questionSaturation` フィールド追加
- テスト: 19/19 green（unit 7 + integration 7 + regression 5）

### live LLM 検証（2026-04-22）
- Scenario A（pushy user）3 ターン: stance=guarded、`disagree`+`set_boundary` 発火、自律性維持
- Scenario B（terse user）3 ターン: 自己開示 + `offer_support` で再エンゲージ
- Scenario C（friendly 10 ターン継続）: 質問・自己開示・提案のバランス維持、D が -0.22 → -0.44 と緩やかに低下

### 全体 regression（2026-04-22）
- `npm run ci:local` all green
- `npm run test:emotion-regression` 91/91
- `npm run eval:smoke` 10/10
- `npx tsc --noEmit` clean
- 新規テストファイル: 5 本、41 tests

## Discoveries

### 事前予測が外れたこと
- **予測**: 「自己開示／弱み見せは `DialogueActSchema` に `self_disclose` enum 追加が必須」
- **実際**: `share_information` が自己開示の器として十分機能した。phase.description の authored guidance + authoredExamples + PAD 低 D baseline の 3 層で、LLM planner が「守りたいと思わせる」を戦略として自発的に言語化する
- **教訓**: スキーマ追加より **データ駆動な guidance の重ね着** の方が費用対効果が高い。schema 追加は長期の drift 対策として温存

### 押して引くの発火パターン（Turn 3 で実証）
ユーザー入力: 「俺はただのサラリーマンだよー。普段は家で仕事して、週末たまに散歩するくらい。セイラちゃんの方がずっとキラキラしてると思うよ」

セイラ応答:
> 「ありがとうございますっ、翔さん！ 家でお仕事中心で週末散歩…地に足ついた感じが素敵です。キラキラしてるって褒めてもらえて、嬉しい気持ちでいっぱいです…えへへ♪ **わたしも本番前は緊張を引きずりやすいんですけど、こんな会話で前向きになれます**。帰り道ですし、**軽くお茶に寄ってみませんか？** 普段の翔さんのこと、もっと聞きたいですっ！」

primaryActs: acknowledge + share_information + suggest

これはユーザー当初例の「もっとあなたとお話ししたいです…あそこの喫茶店でお茶でもどうですか…！」ほぼ完コピ。

### 初動の設計ミスと修正
- 初版は `walk_after_cafe.disallowedActs: ['ask_question']` で質問完全禁止
- ユーザー指摘: 「質問は正解。バランスの問題」
- 修正: `allowedActs` に `ask_question` を戻し、`share_information` / `suggest` も並列で開放
- 学び: 「禁止」ではなく「選択肢を広げる + authored guidance で誘導」の方が LLM は自然に振る舞う

### D 値の長期推移の注意点
- 10 ターンで D が -0.22 → -0.44 まで低下
- 友好的会話でも pleasure が 0.34 → 0.10 まで下がる
- 原因: CoE integrator の `openThreadBias` + 自己開示ターンのネガ寄り appraisal が蓄積
- T-E のせいではないが、T-E の低 D baseline がこの drift を早める
- 将来的な調整候補: `emotion.recovery.dominanceHalfLifeTurns` を会話フェーズ別に変える、または `externalization` weight を見直す

## Decisions

- **T-A（self_disclose enum）Deferred**: T-E の実証で不要と判断。将来 phase condition で「弱み見せイベント」を使いたくなったら再検討
- **T-B（CoE 自己開示シグナル）Deferred**: planner の emotionDeltaIntent で D 低下が機能中。planner drift 時に着手
- **T-D（planner prompt 強化）Deferred**: キャラ固有の phase.description で十分。キャラ 2 体目以降で共通化検討
- **T-C は T-A 非依存で実装**: テキスト中の「？」「?」パターンで十分機能。enum 追加を待つ必要なかった

## Notes

### 触ったファイル
- `src/lib/db/seed-seira.ts`（T-E: 6 ブロック変更）
- `src/mastra/scorers/question-saturation.ts`（T-C: 新規 84 行）
- `src/mastra/scorers/index.ts`（T-C: export 追加）
- `src/mastra/agents/ranker.ts`（T-C: 統合 ~30 行）
- `PLANS.md`（T-E / T-C を Green、T-A/B/D を Deferred）

### 新規テストファイル（5 本、41 tests）
- `tests/workflow/seira-depth-parameter.sandbox.integration.test.ts`（T-E 12 tests）
- `tests/regression/seira-current-version.persona.regression.test.ts`（T-E 10 tests）
- `tests/unit/scorer-question-saturation.unit.test.ts`（T-C 7 tests）
- `tests/workflow/ranker-question-penalty.integration.test.ts`（T-C 7 tests）
- `tests/regression/ranker-baseline.regression.test.ts`（T-C 5 tests）

### ブランチ
- `feature/t-e-conversation-depth`
- 既に `origin/feature/t-e-conversation-depth` に push 済み
- T0-T6 latency 最適化は別 commit（296322c）として main 分離済み

### 将来のキャラ設計者への指針
押して引くを新キャラで実装したい場合、最小手順：
1. `style.initiative` を 0.5-0.6 に設定
2. `emotion.baselinePAD.dominance` を -0.2 前後に
3. `phaseGraph` の進展フェーズ node の `description` に「質問だけで横に広げず、自己開示と提案を織り交ぜる」と明記
4. `authoredExamples.guarded` と `warm` に押して引くパターン台詞を 2 件ずつ
5. phase 遷移条件の 1 つに `emotion.dominance <= -0.3` を OR 加算

schema 追加は基本不要（`share_information` / `suggest` / `express_concern` で十分）。
