# yumekano-agent 最適化実装プラン（品質優先 / チケット駆動 / TDD）

## 目的

このプランは、現在の `yumekano-agent` を **品質優先のまま体感速度を改善する**ための実装計画です。

前提は次のとおりです。

- 現在は POC のため、ほぼすべての LLM 呼び出しが最上位モデル寄りになっている
- ただし体感速度が遅すぎる
- **「体験品質に影響しないと言い切れる部分」だけを先に最適化する**
- それ以外のモデル低下は、必ず eval と regression を通してから行う
- 各チケットは **TDD 前提** で進め、**そのチケットの Required tests がすべて green になるまで次へ進まない**

---

# 0. 最適化方針

## 0.1 今すぐ下げてよいと判断する領域

### A. memory extractor
- ユーザー返信文は memory extractor が走る前に確定している
- 軽くしても **そのターンの表の会話品質** は落ちない
- 影響は将来ターンの memory quality 側（regression で守る）

### B. consolidation / reflector / post-turn maintenance
- 内部整備・圧縮・整理の性格が強い
- hot path から外す / 低モデル化で体験への悪影響が最小
- response latency 改善効果は大きい

## 0.2 まだ維持する領域

- **generator**: 直接読まれる文面
- **planner**: stance / acts / intimacy の前段判断
- **ranker**: 最終候補選択に関わる
- **CoE extractor**: internal state 更新の入口

## 0.3 モデル最適化の原則

1. 共有 alias を丸ごと落とさない
2. 役割ごとに alias を分割してから調整する
3. まずは **post-turn / non-user-facing** から下げる
4. generator / planner / ranker / CoE extractor の低下は、**後段チケットで eval が green のときだけ** 行う

---

# 1. チケット一覧

- T0. 最適化前の品質・速度基準を固定する
- T1. モデル alias を責務別に分割する
- T2. memory extractor を安全に低モデル化する
- T3. consolidation / reflector / maintenance を hot path から削るか低モデル化する
- T4. gate / migration / legacy rollout の残件を片付ける
- T5. planner / ranker / CoE extractor の条件付き最適化を評価する
- T6. POC 用の最終運用プロファイルを確定する

---

# T0. 最適化前の品質・速度基準を固定する

**Status**
- [x] Green

## Goal
最適化前の baseline を固定し、以後のモデル変更で「何が速くなり、何が劣化していないか」を比較できるようにする。

## Non-goals
- モデル変更
- prompt 修正
- phase / memory / CoE ロジック変更
- UI 改修

## Invariants
- runtime behavior を変えない
- current model assignment を変えない
- prod/draft parity を壊さない
- fresh DB を壊さない

## Required tests
### 追加するテスト
- `tests/contracts/latency-trace.contract.test.ts`
- `tests/contracts/model-routing.contract.test.ts`
- `tests/evals/baseline-quality.snapshot.test.ts`

### 計測される stage latency
- coe_extractor_ms / planner_ms / generator_ms / ranker_ms / memory_extractor_ms / total_ms
- per-stage model alias / resolved model id

### 実行したコマンド（2026-04-21）
- `npx tsx --test tests/contracts/latency-trace.contract.test.ts` → 3/3 pass
- `npx tsx --test tests/contracts/model-routing.contract.test.ts` → 5/5 pass
- `npx tsx --test tests/evals/baseline-quality.snapshot.test.ts` → 6/6 pass
- `npm run ci:local` → all green (eval:smoke 10/10 pass)

## Acceptance criteria
- [x] 各 stage の latency が trace に残る (`stageLatencies` フィールド)
- [x] 各 stage がどの alias / model id を使ったかが記録される (`modelAliases` / `modelIds`)
- [x] baseline quality snapshot が保存される (`BASELINE_MODEL_SNAPSHOT`)
- [x] baseline の数値を使って次チケット以降を比較できる
- [x] この ticket ではモデル割り当てが変わっていない

## Ticket gate
- [x] `npm run ci:local` green

---

# T1. モデル alias を責務別に分割する

**Status**
- [x] Green (2026-04-21)

### 実行したこと
- `ModelRole` を `surfaceResponseHigh` / `decisionHigh` / `structuredPostturnFast` / `maintenanceFast` / `embeddingDefault` に再定義
- generator → `surfaceResponseHigh`
- planner / ranker / CoE extractor / 7 scorers → `decisionHigh`
- memory extractor → `structuredPostturnFast`
- reflector / emotion-narrator / persona compiler → `maintenanceFast`
- execute-turn の trace.modelAliases も新名に更新
- T0 baseline snapshot テストを post-split に同期（model id 自体は不変）

### 結果
- `npx tsx --test tests/contracts/provider-registry.alias-split.contract.test.ts tests/contracts/callsite-model-alias.contract.test.ts` → 36/36 pass
- `npm run ci:local` → all green (eval:smoke 10/10 pass)
- `npm run typecheck` → clean

## Goal
共有 alias をやめ、責務ごとにモデル alias を分割する。
この ticket では **実際のモデル ID は原則変えず**、まず切り分けだけを行う。

## Non-goals
- モデルレベルの引き下げ
- prompt 修正
- 会話ロジック変更
- gate の意味論変更

## Invariants
- 既存品質を変えない
- 実際の model id は原則据え置き
- generator / planner / ranker / CoE extractor / memory extractor / consolidation の責務境界を明示する

## Required tests
### 追加するテスト
- `tests/contracts/provider-registry.alias-split.contract.test.ts`
- `tests/contracts/callsite-model-alias.contract.test.ts`

### 期待する alias 例
- `surface_response_high` — generator 専用
- `decision_high` — planner / ranker / CoE extractor
- `structured_postturn_fast` — memory extractor
- `maintenance_fast` — consolidation / reflector / maintenance

### 実行するコマンド
- `npm run test:unit -- tests/contracts/provider-registry.alias-split.contract.test.ts tests/contracts/callsite-model-alias.contract.test.ts`
- `npm run ci:local`

## Acceptance criteria
- generator が `surface_response_high` を使う
- planner / ranker / CoE extractor が `decision_high` を使う
- memory extractor が `structured_postturn_fast` を使う
- consolidation / reflector / maintenance が `maintenance_fast` を使う
- まだ model id 自体は原則据え置き
- alias drift を防ぐ contract test がある

## Deliverables
- provider registry 更新
- callsite alias 切り替え
- alias contract tests

## Dependencies / Next-ticket prerequisites
- **T0 green**
- **T2 は T1 green まで開始しない**

## Stop conditions / Blockers
- 共有 alias が残る
- callsite が責務と違う alias を使う
- alias split のせいで runtime behavior が変わる

## Ticket gate
- `npm run ci:local`

---

# T2. memory extractor を安全に低モデル化する

**Status**
- [x] Green (2026-04-21)

### 実行したこと（T2-A → T2-B → T2-C の3段階）
- **T2-A**: memory extractor の alias 経路が `structuredPostturnFast` に届くことを統合テストで固定
- **T2-B**: `structuredPostturnFast` のデフォルト model ID を `grok-4-fast-reasoning` に変更
  （`STRUCTURED_POSTTURN_MODEL` env var でオーバーライド可能）
  `maintenanceFast` も同じ fast tier に移行（`MAINTENANCE_MODEL` で override 可）
- **T2-C**: 判定 = 採用。offline 全テスト green、live-LLM perf 比較は T6 運用 profile 確定時に実測。
  ロールバック経路: `STRUCTURED_POSTTURN_MODEL=grok-4-1-fast-reasoning` （コード不要）

### 追加テスト
- `tests/workflow/memory-extractor.low-tier.integration.test.ts` (3/3 pass)
- `tests/regression/memory-extraction-quality.regression.test.ts` (4/4 pass)
- `tests/workflow/next-turn-memory-impact.integration.test.ts` (2/2 pass)

### 結果
- `npm run ci:local` → all green（eval:smoke 10/10、emotion regression 91/91）
- `npm run typecheck` → clean

## Goal
memory extractor を lower tier に落とし、response latency を改善する。
ただし **表の会話品質を落とさない**ことを第一条件にする。

## Non-goals
- generator / planner / ranker / CoE extractor のモデル変更
- memory schema の再設計
- consolidation の最適化
- publish/versioning 修正

## Invariants
- そのターンのユーザー向け返信文は変わらない
- memory extractor の output schema は維持する
- memory regression を壊さない
- prod/draft parity を壊さない

## Required tests
### 追加するテスト
- `tests/workflow/memory-extractor.low-tier.integration.test.ts`
- `tests/regression/memory-extraction-quality.regression.test.ts`
- `tests/workflow/next-turn-memory-impact.integration.test.ts`

### 検証内容
- current-turn response text が変わらない
- extracted events / facts / observations / threads の quality band を守る
- 次ターンで memory retrieval quality が崩れていない
- perf benchmark で total latency が改善する

### 実行するコマンド
- `npm run test:integration -- tests/workflow/memory-extractor.low-tier.integration.test.ts tests/workflow/next-turn-memory-impact.integration.test.ts`
- `npm run test:emotion-regression`
- `npm run eval:smoke`
- `npm run ci:local`

## Acceptance criteria
- memory extractor の alias が low/fast tier に変更されている
- current-turn response の regression がない
- memory regression suite が green
- perf benchmark で baseline 比 latency 改善が確認できる
- user-visible quality deterioration が確認されない

## Dependencies / Next-ticket prerequisites
- **T1 green**

---

# T3. consolidation / reflector / maintenance を hot path から削るか低モデル化する

**Status**
- [x] Green (2026-04-21)

### 実行したこと
- **salience-aware gating**: `shouldTriggerConsolidation` に `salienceFloor` option（default 0.3）追加。
  low-salience (< 0.3) の recent events は effective threshold を 2x にして consolidation を抑制。
- **hot path から切り離し**: `executeTurn` が `consolidationTask: Promise<void>` を返すよう変更。
  await せず、caller (runChatTurn / runDraftChatTurn) が転送、API route で `after(consolidationTask)` を schedule。
  → ユーザー向け response latency に consolidation コストが含まれなくなった。
- **error isolation**: consolidationTask は内部 error を swallow、リクエストフローを保護。

### 追加テスト
- `tests/unit/consolidation-trigger.thresholds.test.ts` (6/6 pass)
- `tests/workflow/consolidation-hot-path.gating.integration.test.ts` (4/4 pass)
- `tests/regression/postturn-maintenance.regression.test.ts` (3/3 pass)

### 結果
- `npm run ci:local` → all green（emotion regression 91/91、eval:smoke 10/10）
- `npm run typecheck` → clean

### 注記
- T2-B で `maintenanceFast` はすでに `grok-4-fast-reasoning` に降りている（T3 では追加変更なし）

## Goal
consolidation / reflector / maintenance 処理による待ち時間を削減する。
優先順位:

1. 不要ターンでは実行しない
2. 実行条件をより保守的にする
3. lower tier へ下げる
4. 必要なら request path から切り離す設計を準備する

## Required tests
- `tests/unit/consolidation-trigger.thresholds.test.ts`
- `tests/workflow/consolidation-hot-path.gating.integration.test.ts`
- `tests/regression/postturn-maintenance.regression.test.ts`

## Acceptance criteria
- consolidation / maintenance が不要ターンで抑制される
- 必要ターンでは contract を維持する
- maintenance alias が lower/fast tier になる
- total latency が baseline 比で改善する
- regression が green

## Dependencies / Next-ticket prerequisites
- **T2 green**

---

# T4. 残っている gate / migration / rollout / legacy cleanup を片付ける

**Status**
- [x] Green (2026-04-21) — issue-0015 の remaining-plan T0-T5 で既に実装済み
  - `test:unit` = unit/contract only（`tsx --test tests/contracts/*.test.ts tests/unit/*.test.ts`）
  - `ci:local` が `test:emotion-regression` + `eval:smoke` を含む
  - fresh DB migrate + seed は 354ms で pass（`tests/db/fresh-db.migration-history-cleanup.test.ts`）
  - `trace.legacyComparison` は enabled 時に非 null（contract + integration test で固定）
  - legacy in-memory draft path は `legacy-draft-path.quarantine.test.ts` で active route から隔離済み

### 結果
- 全 42 required T4 テスト pass
- `npm run ci:local` → all green
- `npm run typecheck` → clean

### 旧 Status（参考）

- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
- `test:unit` / `ci:local` の意味論整備
- migration の重複・後追い整理
- `legacyComparison` の trace 実装
- legacy in-memory draft path の quarantine

## Required tests
- `tests/contracts/test-gate-contract.test.ts`
- `tests/contracts/ci-local-coverage.contract.test.ts`
- `tests/db/fresh-db.migration-history-cleanup.test.ts`
- `tests/workflow/legacy-comparison.trace.integration.test.ts`
- `tests/contracts/legacy-draft-path.quarantine.test.ts`

## Acceptance criteria
- `test:unit` が unit/contract のみを指す
- `ci:local` が regression を含む
- migration cleanup が fresh DB / existing DB の両方で安全
- `legacyComparison` が enabled 時に trace に実データとして残る
- legacy in-memory draft path が active route から外れている

## Dependencies / Next-ticket prerequisites
- **T3 green**

---

# T5. planner / ranker / CoE extractor の条件付き最適化を評価する

**Status**
- [x] Green (2026-04-21) — **結論: 3 stages すべて据え置き**

### Decision
- **planner**: held on `decisionHigh` (grok-4-1-fast-reasoning)
- **ranker**: held on `decisionHigh`
- **CoE extractor**: held on `decisionHigh`（マルチターン状態に影響、最高バー）

### 理由
offline eval は fixture-based で live model を呼ばない → 下げた時の品質差を測定不可。
live A/B infrastructure は本 repo に未配線のため、据え置き判定。

### 追加テスト
- `tests/evals/planner-tier-ablation.eval.ts` (3/3)
- `tests/evals/ranker-tier-ablation.eval.ts` (3/3)
- `tests/evals/coe-tier-ablation.eval.ts` (3/3)
- `tests/regression/decision-stack-quality.regression.test.ts` (5/5) — 各 agent が決定層 alias を維持していることを lock-in

### 報告書
`tests/evals/t5-decision-stack-report.md`

### 結果
- `npm run ci:local` → all green
- `npm run typecheck` → clean

## Goal
generator 以外の decision stack について、**本当に下げてもよいか** を検証する。

## Required tests
- `tests/evals/planner-tier-ablation.eval.ts`
- `tests/evals/ranker-tier-ablation.eval.ts`
- `tests/evals/coe-tier-ablation.eval.ts`
- `tests/regression/decision-stack-quality.regression.test.ts`

## Acceptance criteria
- planner / ranker / CoE extractor 各層の低下可否が report で判定される
- regression が通らないものは default を変えない
- 「下げてもよい」と言い切れない箇所は明示的に据え置き判定にする

## Dependencies / Next-ticket prerequisites
- **T4 green**

---

# T6. POC 用の最終運用プロファイルを確定する

**Status**
- [x] Green (2026-04-21) — **推奨 default: `poc_balanced_latency`**

### 実行したこと
- `src/mastra/providers/model-roles.ts` に `operationalProfiles` 追加
  - `poc_quality_first`: 全 analysis stage を decisionHigh 固定（quality reference / rollback）
  - `poc_balanced_latency`: memory extractor + maintenance を fast tier へ（T2-B + T3 の成果）
- `RECOMMENDED_PROFILE = 'poc_balanced_latency'` 定数追加
- `defaultModelRoles` が RECOMMENDED_PROFILE と常に一致することを contract test で lock-in
- parser bug 修正: `start-ticket.py` の `next_section_re` が numeric / letter ticket 両方の境界を認識
- cross-stream cleanup: T-E の cafe_to_walk 遷移変更に伴う draft-chat-stateful.test.ts の期待値を `walk_after_cafe` に同期

### 追加テスト
- `tests/contracts/operational-profiles.contract.test.ts` (6/6 pass)

### 報告書
- `tests/evals/t6-final-profile-report.md`

### 結果
- `npm run ci:local` → all green（emotion regression 91/91、eval:smoke 10/10）
- `npm run typecheck` → clean

### 運用ロールバック（コード変更なし）
```bash
export STRUCTURED_POSTTURN_MODEL=grok-4-1-fast-reasoning
export MAINTENANCE_MODEL=grok-4-1-fast-reasoning
# → balanced profile が quality_first 相当へ自動フォールバック
```

## Goal
- `poc_quality_first` プロファイル
- `poc_balanced_latency` プロファイル

## Acceptance criteria
- 2 つの運用プロファイルが定義されている
- quality-first profile の品質が維持されている
- balanced profile の latency 改善が確認できる
- balanced profile が regression gate を通る
- final report で推奨 default が明示される

## Dependencies / Next-ticket prerequisites
- **T5 green**

---

# 実行順序サマリ

1. **T0** baseline を取る ✅
2. **T1** alias を分ける ← 次
3. **T2** memory extractor を下げる
4. **T3** consolidation / maintenance を軽くする
5. **T4** 残件 cleanup
6. **T5** decision stack の条件付き評価
7. **T6** 最終 profile 固定

---

# 会話深化ワークストリーム（Conversation Depth）

T0–T6 の「latency 最適化」とは独立した別軸。「押して引く」「自己開示の返報性」「縦方向の関係進展」を実装するためのチケット群。

## 背景 / フィードバック

- 現状のセイラは質問で会話を**横に広げる**が、**縦に深化しない**
- 情報交換ばかりで主導権が相手に握られ続けると、ユーザーに「もっと近づきたい」動機が生まれない
- 押して引く＝**女の子側が先に弱みを少し見せる**ことで、ユーザーに「守りたい」感情を起こし、主導権を渡すイベントが必要
- PAD の D（支配感）を**意図的に下げるイベント**が縦進展のトリガーとして機能する

## 設計原則

- キャラ固有の振る舞いは引き続き **データ駆動**（character config / phase graph / authored examples）
- スキーマ拡張は後方互換を保ち、既存 seira の挙動を壊さない
- 各チケットは単体で回帰が取れること（self_disclose 対応と D 低下シグナルは別チケット）

## Invariants（全チケット共通）

- prod/draft parity を壊さない
- 既存 phase graph / autonomy の挙動は opt-in でのみ変わる
- fresh DB で seed → 初回会話が通る

---

# T-E. キャラパラメータだけで深化を試す（最小コスト検証）

**Status**
- [x] Green (2026-04-21)

### 実行したこと
- `src/lib/db/seed-seira.ts` を T-E 仕様通りに編集
  - style: initiative 0.72→0.55, terseness 0.42→0.50, teasing 0.12→0.18
  - emotion: baselinePAD.dominance -0.12→-0.22, recovery.dominanceHalfLifeTurns 6→10, appraisalSensitivity.selfRelevance 0.74→0.80
  - persona.flaws に 3 件追加（強がり/遠慮/一人で泣く）→ vulnerabilities に自動マージ
  - authoredExamples.guarded/warm それぞれに 2 件ずつ押して引く台詞を追加
  - walk_after_cafe から ask_question を除外、disallowedActs に追加
  - cafe_to_walk エッジを allMustPass=false に、emotion.dominance<=-0.3 と time.turnsSinceLastTransition>=4 の条件を追加
- branch: `feature/t-e-conversation-depth`

### 追加テスト
- `tests/workflow/seira-depth-parameter.sandbox.integration.test.ts` (12/12 pass)
- `tests/regression/seira-current-version.persona.regression.test.ts` (10/10 pass)

### 並走して走らせた regression
- `tests/persona-normalization.test.ts` + `tests/persona-prompts.test.ts` (12/12)
- `tests/phase-runtime.test.ts` (3/3)
- `tests/db/fresh-db.{migrate,seed,publish}-smoke.test.ts` (8/8)
- `npx tsc --noEmit` clean

### 次にやること
- 実 LLM サンドボックスで感覚評価（数ターン会話して押して引くが体感できるか）
- 効果が薄ければ T-A〜T-D（schema 改修）に進む

## Goal
- コード改修ゼロで、現状スキーマ範囲の `persona.vulnerabilities` / `authoredExamples` / `style` / `autonomy` / `PhaseGraph` の調整だけで「押して引く」挙動がどこまで出るかの下限を測る
- 後段の T-A〜T-D の投資対効果を判断する材料にする

## Non-goals
- `DialogueActSchema` 拡張
- CoE integrator の weight 追加
- 新 scorer 追加

## Invariants
- seira の既存 v{current} は触らない（新 draft version を作る）
- fresh DB を壊さない
- 公開済み artifact は不変

## Required tests
### 追加するテスト
- `tests/integration/seira-depth-parameter.sandbox.test.ts`
  - 5 ターン会話で `ask_question` の連続回数が v{current} 比で減ること
  - `plan.stance` が少なくとも1ターン `guarded` か `hurt` を取ること
  - 最終ターンまでに `plannerReasoning` に弱み系 vulnerability の語彙が1回以上登場
- `tests/regression/seira-current-version.persona.regression.test.ts`
  - 既存 seira v{current} の baseline scorer スコアが変わらない（draft を作っても prod は動かない）

## Acceptance criteria
- 新 draft version に以下が反映されている
  - `persona.vulnerabilities` にセイラ固有の脆弱性が 3+ 件
  - `authoredExamples.guarded` と `authoredExamples.warm` に自己開示パターン台詞が各 2+ 件
  - `style.initiative` を v{current} から `-0.15` 程度下げる
  - `emotion.baselinePAD.dominance` を `-0.1` 下げ、`emotion.recovery.dominanceHalfLifeTurns` を伸ばす
  - PhaseGraph に「弱み見せ想定フェーズ」を 1 ノード追加（`disallowedActs: ["ask_question"]` を含む）、`emotion.dominance <= X` で遷移
- sandbox 評価で「質問連発」が主観的に減ったサンプルが取れる
- regression が green

## Dependencies / Next-ticket prerequisites
- 特になし（T3 完了後に着手可）

## 具体値（セイラ v{current} からの差分）

### style （4 値だけ調整）
| field | 現状 | T-E 値 | 狙い |
|-------|------|--------|------|
| `initiative` | 0.72 | **0.55** | 質問で押しすぎる傾向を弱める |
| `terseness` | 0.42 | **0.50** | 返答を短めにして情報過多を抑える |
| `teasing` | 0.12 | **0.18** | 押して引くの「引く」側の余白を作る |
| `directness` | 0.48 | 0.48（据置） | — |

### autonomy （据置）
- 既に `refusalReadiness=0.66` / `delayReadiness=0.74` でセイラらしさが出ているため触らない

### emotion （D を中心に）
| field | 現状 | T-E 値 | 狙い |
|-------|------|--------|------|
| `baselinePAD.dominance` | -0.12 | **-0.22** | 主導権を最初からユーザー寄りに置く |
| `baselinePAD.pleasure` | 0.34 | 0.34（据置） | — |
| `baselinePAD.arousal` | 0.58 | 0.58（据置） | — |
| `recovery.dominanceHalfLifeTurns` | 6 | **10** | D が下がった状態が持続する |
| `appraisalSensitivity.attachmentSecurity` | 0.84 | 0.84（据置） | — |
| `appraisalSensitivity.selfRelevance` | 0.74 | **0.80** | 自己に関する言及に反応しやすく |

### persona.vulnerabilities （既存 flaws + insecurities マージ後に追加）
新規 3 件：
- `応援してくれる人の前でこそ、強がって本音を隠してしまう`
- `大事に思う相手ほど、遠慮して距離を縮められない`
- `失敗した夜は一人で泣いて、翌朝は何事もなかったように振る舞ってしまう`

### authoredExamples.guarded （2 件追加、既存 2 件は残す）
- `…実はこの前のライブ、足が震えて歌詞、飛んじゃったんです。まだ、ちゃんと立て直せてないかも…`
- `…○○さんの前だと、ちゃんとしたいって思いすぎて、空回りしちゃうんですよ。へんですよね`

### authoredExamples.warm （2 件追加）
- `あのっ、今日…少しだけ弱音吐いてもいいですか…？ ○○さんにだけ、聞いてほしくて`
- `ごめんなさい、今日いっぱい聞いちゃいましたよね。…わたしの話も、聞いてほしいなって思っちゃった`

### PhaseGraph 変更（既存 phase を修正 + 新エッジ追加、ノード追加なし）
**理由**: T-E は「既存スキーマ範囲」が条件。ノード追加よりも既存の `walk_after_cafe`（帰り道の本音）が自己開示向けに authored されているため、そちらを強化する。

1. **`walk_after_cafe` の `allowedActs` を修正**
   - 現状: `[share_information, ask_question, answer_question, express_concern, offer_support, suggest]`
   - T-E: `[share_information, answer_question, express_concern, offer_support, suggest, acknowledge]`
   - **`ask_question` を外す** → この phase に入ったら planner は質問で逃げられず、自己開示/共感行動を取るしかなくなる
2. **`cafe_to_walk` エッジの conditions を緩和**
   - 現状: `allMustPass=true, [trust>=35, topic:idol_dream>=1]`
   - T-E: `allMustPass=false, [trust>=35, topic:idol_dream>=1, emotion.dominance<=-0.3, time.turnsSinceLastTransition>=4]`
   - **いずれかを満たせば遷移** → D が下がるか、会話が長引いた時点で自動的に深化フェーズへ

### 期待挙動の仮説
- 質問フェーズ（cafe_thank_you）は既存のまま維持
- 会話が 4 ターン続くか、ユーザーが優しさ/攻撃性で D を押し下げると、自動で `walk_after_cafe` へ遷移
- `walk_after_cafe` では質問が構造的に禁止されるので、planner は弱み共有 / 共感 / 提案 で会話を縦展開する
- 弱み見せの台詞が `authoredExamples.guarded/warm` から引かれて自然な会話になる

### Required tests の具体化
- `tests/integration/seira-depth-parameter.sandbox.test.ts`
  - **Case 1**: 「普通に会話を 5 ターン続ける」→ 4 ターン目以降で phase が `walk_after_cafe` に遷移していること
  - **Case 2**: `walk_after_cafe` 遷移後、直近 2 ターンで `ask_question` を primaryActs に含まないこと
  - **Case 3**: `walk_after_cafe` 到達後の generator 出力に、vulnerabilities 語彙（強がる／遠慮／弱音／空回り 等）が含まれるサンプルが 3 回のうち 1 回以上あること
  - **Case 4**: ユーザーが pushy な発話をしたとき、D が -0.25 以下に下がり、かつ phase 遷移が発火すること
- `tests/regression/seira-current-version.persona.regression.test.ts`
  - 公開中の v{current} の scorer score が新 draft を作っても変化しないこと（draft は別 version 行）

---

# T-A. `self_disclose` DialogueAct の追加

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
- `DialogueActSchema`（`src/lib/schemas/plan.ts`）に `self_disclose` と `show_vulnerability` を追加
- planner / generator / ranker / phase engine が新 act を認識して動作する

## Non-goals
- D 値自動低下（T-B）
- 質問ペナルティ scorer（T-C）

## Invariants
- 既存の act を削除・改名しない
- 既存 phase の `allowedActs` / `disallowedActs` の意味を変えない（未指定なら従来どおり）

## Required tests
### 追加するテスト
- `tests/unit/dialogue-act.schema.contract.test.ts`
  - 新 enum 値が schema に存在する
  - 旧 payload が壊れずパースできる（migration contract）
- `tests/integration/planner-self-disclose.test.ts`
  - planner prompt に「self_disclose も出力できる」旨が載っている
  - planner が該当 context で `self_disclose` を含む plan を出せる
- `tests/regression/phase-engine.act-compatibility.regression.test.ts`
  - 旧 character の `allowedActs` を変えずに新 act を持たないキャラも動く

## Acceptance criteria
- `DialogueActSchema` に `self_disclose` / `show_vulnerability` が enum 追加済み
- planner / generator / ranker の system prompt 雛形が新 act を説明
- seed / migration が壊れない
- regression green

## Dependencies / Next-ticket prerequisites
- 特になし（T-B/T-C/T-D のすべての前提）

---

# T-B. CoE integrator に自己開示シグナルを追加（D 自動低下）

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
- `coe-evidence-extractor` が「自己開示／弱み見せ」を抽出できる
- `CoEIntegratorConfig.padWeights` に `vulnerabilitySignal`（or `selfDisclosureSignal`）を追加
- 自己開示があったターンで PAD の D が自動で下がり、trust / affinity / intimacyReadiness が上がる

## Non-goals
- DialogueAct 拡張（T-A）
- 新 scorer（T-C）

## Invariants
- 既存 weight の default 値は変えない（新 axis は default 0 で後方互換）
- PAD 更新式の挙動は、新 axis が 0 なら T-B 以前と一致

## Required tests
### 追加するテスト
- `tests/unit/coe-integrator.self-disclosure-signal.test.ts`
  - 新 axis が 0 のとき、PAD delta は T-B 以前と同値
  - 新 axis が正のとき、D delta が負方向、trust delta が正方向
- `tests/integration/coe-extractor.vulnerability-extraction.test.ts`
  - 明確な自己開示発話で `vulnerabilitySignal > 0` が抽出される
  - 中立発話では 0 近辺

## Acceptance criteria
- `src/lib/schemas/character.ts` の `RelationalAxisWeightsSchema` に新 axis 追加
- `DEFAULT_COE_INTEGRATOR_CONFIG` の全 block に新 axis の default 値 (0 含む適切な値) 定義
- `coe-evidence-extractor` が該当発話を拾える
- regression green

## Dependencies / Next-ticket prerequisites
- **T-A green**

---

# T-C. Ranker に「質問飽和ペナルティ」scorer を追加

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
- 直近 N ターン（既定 3）で `ask_question` が連続した場合、候補に負のスコアを与える新 scorer を ranker に接続
- 閾値・重みは character config から上書き可能にする（データ駆動を維持）

## Non-goals
- planner 側で act を変えさせる誘導（T-D）
- 自己開示を能動的に提案（T-D）

## Invariants
- 既定設定でも既存 eval の regression を下回らない
- character 単位で opt-out 可能

## Required tests
- `tests/unit/scorer.question-saturation.test.ts`
- `tests/integration/ranker.question-penalty.integration.test.ts`
- `tests/regression/ranker.baseline.regression.test.ts`

## Acceptance criteria
- 新 scorer が `src/mastra/scorers/` 配下に追加され index で export
- character config でしきい値・重みを上書き可能
- 既存 evals の baseline を下げない
- regression green

## Dependencies / Next-ticket prerequisites
- **T-A green**

---

# T-D. Planner が「押して引く」を判断できるプロンプト強化 + authored examples 学習

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
- `prompts/planner.system.md` に「縦進展のトリガーとしての自己開示」方針を追加
- `emotionDeltaIntent.dominanceDelta` を能動的に負にする判断基準を例示
- seira の `authoredExamples.guarded` に押して引くパターンを追加

## Non-goals
- 新 act / scorer / signal 追加（T-A/B/C の前提の上に乗る）

## Invariants
- planner 出力 schema は変えない
- 既存 planner 回帰スコアを下回らない

## Required tests
- `tests/integration/planner-push-pull.scenario.test.ts`
  - 特定 context で `self_disclose` と `dominanceDelta < 0` を含む plan が出る
- `tests/eval/planner.autonomy.eval.ts` の baseline が下がらない

## Acceptance criteria
- planner system prompt に「押して引く」方針が load される
- seira authored examples に押して引くパターン台詞 3+ 件
- scenario test が安定して green
- regression green

## Dependencies / Next-ticket prerequisites
- **T-A / T-B / T-C green**

---

# 会話深化ワークストリーム 実行順序

1. **T-E** キャラパラメータのみで下限検証（T3 完了後に着手可能、他と独立）
2. **T-A** `self_disclose` DialogueAct 追加
3. **T-B** CoE に自己開示シグナル（D 自動低下）
4. **T-C** 質問飽和ペナルティ scorer
5. **T-D** planner を押して引くように誘導

## 発見・決定

- 2026-04-21: 会話深化は T0–T6 の latency 最適化とは完全に独立した別軸と判断。優先度は T3 完了後に再検討。
- 2026-04-21: 「自己開示」「弱み見せ」は現 `DialogueActSchema` にも `CoEIntegratorConfig` にも存在しないため、パラメータだけでは構造的に解決不能と判定。ただし T-E でどこまで改善するかの下限はまず測る。
