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
理由:
- ユーザーに見える返信文は、memory extractor が走る前に確定している
- ここを軽くしても **そのターンの表の会話品質** は落ちない
- 影響が出るとしたら将来ターンの memory quality 側だが、これは regression で守れる

### B. consolidation / reflector / post-turn maintenance
理由:
- ユーザーの表の返答品質より、内部整備・圧縮・整理の性格が強い
- ここを hot path から外す、もしくは低モデル化しても体験への悪影響が最小
- むしろ response latency を大きく改善しやすい

## 0.2 まだ維持する領域

### A. generator
理由:
- 直接ユーザーが読む文面そのもの
- ここを落とすと、自然さ・温度感・言い回しが最初に劣化しやすい

### B. planner
理由:
- stance / acts / intimacy decision / mustAvoid の前段判断を担う
- ここが鈍ると generator より先に会話設計が崩れる

### C. ranker
理由:
- deterministic gate があるとはいえ、最終候補選択に関わる
- いまはまだ「安全に下げてよい」と言い切れない

### D. CoE extractor
理由:
- internal state 更新の入口
- ここを落とすと、文面より先に感情状態の一貫性が壊れる可能性がある

## 0.3 モデル最適化の原則

1. 共有 alias を丸ごと落とさない  
2. 役割ごとに alias を分割してから調整する  
3. まずは **post-turn / non-user-facing** から下げる  
4. generator / planner / ranker / CoE extractor の低下は、**後段のチケットで eval が green のときだけ** 行う

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
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

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

### 追加する計測
- stage latency:
  - coe_extractor_ms
  - planner_ms
  - generator_ms
  - ranker_ms
  - memory_extractor_ms
  - consolidation_ms
- total turn latency
- per-stage model alias / resolved model id

### 実行するコマンド
- `npm run test:workflow`
- `npm run test:integration`
- `npm run test:emotion-regression`
- `npm run eval:smoke`
- `npm run ci:local`

## Acceptance criteria
- 各 stage の latency が trace もしくは benchmark artifact に残る
- 各 stage がどの alias / model id を使ったかが記録される
- baseline quality snapshot が保存される
- baseline の数値を使って次チケット以降を比較できる
- この ticket ではモデル割り当てが変わっていない

## Deliverables
- latency instrumentation
- model-routing trace
- baseline report
- baseline quality snapshot

## Dependencies / Next-ticket prerequisites
- なし
- **T1 は T0 green まで開始しない**

## Stop conditions / Blockers
- latency が stage 単位で取れない
- baseline quality snapshot がない
- 何が変わったか比較不能なまま次へ進もうとする

## Ticket gate
- `npm run ci:local`

---

# T1. モデル alias を責務別に分割する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

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
- `surface_response_high`
- `decision_high`
- `structured_postturn_fast`
- `maintenance_fast`

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
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

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

## Deliverables
- memory extractor model assignment 更新
- regression tests
- benchmark comparison report

## Dependencies / Next-ticket prerequisites
- **T1 green**
- **T3 は T2 green まで開始しない**

## Stop conditions / Blockers
- memory quality regression
- 次ターン memory retrieval の質低下
- 表の会話品質に影響が出る
- perf 改善が出ない

## Ticket gate
- `npm run ci:local`

---

# T3. consolidation / reflector / maintenance を hot path から削るか低モデル化する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
consolidation / reflector / maintenance 処理による待ち時間を削減する。  
優先順位は次の順とする。

1. 不要ターンでは実行しない  
2. 実行条件をより保守的にする  
3. lower tier へ下げる  
4. 必要なら request path から切り離す設計を準備する

## Non-goals
- generator / planner / ranker / CoE extractor のモデル変更
- memory extractor の再調整
- prompt 修正
- UI 改修

## Invariants
- current-turn user-visible reply quality を変えない
- memory consistency を壊さない
- consolidation は必要ターンでは残す
- data loss を起こさない

## Required tests
### 追加するテスト
- `tests/unit/consolidation-trigger.thresholds.test.ts`
- `tests/workflow/consolidation-hot-path.gating.integration.test.ts`
- `tests/regression/postturn-maintenance.regression.test.ts`

### 検証内容
- 低重要度ターンでは consolidation が走らない
- 高重要度ターンでは必要な maintenance が走る
- lower tier 化しても post-turn artifacts が contract を満たす
- hot path latency が改善する

### 実行するコマンド
- `npm run test:unit -- tests/unit/consolidation-trigger.thresholds.test.ts`
- `npm run test:integration -- tests/workflow/consolidation-hot-path.gating.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- consolidation / maintenance が不要ターンで抑制される
- 必要ターンでは contract を維持する
- maintenance alias が lower/fast tier になる
- total latency が baseline 比で改善する
- regression が green

## Deliverables
- trigger threshold 調整
- maintenance model assignment 更新
- hot-path gating 実装
- regression tests
- benchmark report

## Dependencies / Next-ticket prerequisites
- **T2 green**
- **T4 は T3 green まで開始しない**

## Stop conditions / Blockers
- high-salience turn で maintenance が落ちる
- memory consistency regression
- perf 改善が出ない
- current-turn quality に影響が出る

## Ticket gate
- `npm run ci:local`

---

# T4. 残っている gate / migration / rollout / legacy cleanup を片付ける

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
最適化の前提として残っている技術負債を閉じる。  
この ticket では特に次を対象にする。

- `test:unit` / `ci:local` の意味論整備
- migration の重複・後追い整理
- `legacyComparison` の trace 実装
- legacy in-memory draft path の quarantine

## Non-goals
- generator / planner / ranker / CoE extractor のモデル変更
- prompt の大改稿
- phase 設計変更
- 新機能追加

## Invariants
- fresh DB を壊さない
- runtime schema canonical を守る
- prod/draft parity を壊さない
- legacy path を残すなら inactive/deprecated を明確にする

## Required tests
### 追加するテスト
- `tests/contracts/test-gate-contract.test.ts`
- `tests/contracts/ci-local-coverage.contract.test.ts`
- `tests/db/fresh-db.migration-history-cleanup.test.ts`
- `tests/workflow/legacy-comparison.trace.integration.test.ts`
- `tests/contracts/legacy-draft-path.quarantine.test.ts`

### 実行するコマンド
- `npm run test:db`
- `npm run test:workflow`
- `npm run test:migrations`
- `npm run ci:local`

## Acceptance criteria
- `test:unit` が unit/contract のみを指す
- `ci:local` が regression を含む
- migration cleanup が fresh DB / existing DB の両方で安全
- `legacyComparison` が enabled 時に trace に実データとして残る
- legacy in-memory draft path が active route から外れている

## Deliverables
- scripts 修正
- migration cleanup
- legacyComparison 実装
- legacy path quarantine
- contract tests / integration tests

## Dependencies / Next-ticket prerequisites
- **T3 green**
- **T5 は T4 green まで開始しない**

## Stop conditions / Blockers
- fresh DB が壊れる
- migration cleanup で既存 DB 互換性が不明
- legacyComparison が null のまま
- ci gate の意味が曖昧なまま

## Ticket gate
- `npm run ci:local`

---

# T5. planner / ranker / CoE extractor の条件付き最適化を評価する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
generator 以外の decision stack について、**本当に下げてもよいか** を検証する。  
ここでは「下げること」自体がゴールではなく、**下げても問題ないと証明できた場合だけ採用**する。

## Non-goals
- generator の低モデル化
- unguarded な本番デフォルト変更
- prompt 文面の再設計
- memory schema 変更

## Invariants
- generator は高モデル維持
- planner / ranker / CoE extractor を下げるなら feature flag 前提
- eval / regression で証明できない限り default を変えない
- user-visible quality を落とさない

## Required tests
### 追加するテスト / 実験
- `tests/evals/planner-tier-ablation.eval.ts`
- `tests/evals/ranker-tier-ablation.eval.ts`
- `tests/evals/coe-tier-ablation.eval.ts`
- `tests/regression/decision-stack-quality.regression.test.ts`

### 比較条件
- current high tier
- one-step lower tier
- 必要なら mixed policy

### 実行するコマンド
- `npm run eval:smoke`
- `npm run test:emotion-regression`
- `npm run ci:local`

## Acceptance criteria
- planner 低下の可否が report で判定される
- ranker 低下の可否が report で判定される
- CoE extractor 低下の可否が report で判定される
- regression が通らないものは default を変えない
- 「下げてもよい」と言い切れない箇所は明示的に据え置き判定にする

## Deliverables
- ablation eval scripts
- comparison report
- feature flags
- default recommendation

## Dependencies / Next-ticket prerequisites
- **T4 green**
- **T6 は T5 green まで開始しない**

## Stop conditions / Blockers
- eval で regression が出る
- どの tier が使われたか比較できない
- generator にまで scope が広がる
- report が曖昧で採用判断できない

## Ticket gate
- `npm run ci:local`

---

# T6. POC 用の最終運用プロファイルを確定する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
POC として実運用するためのモデル構成を最終化する。  
少なくとも次の 2 プロファイルを持てるようにする。

- `poc_quality_first`
- `poc_balanced_latency`

## Non-goals
- 新機能開発
- UI redesign
- prompt 大改稿
- architecture の再設計

## Invariants
- current best quality profile を失わない
- balanced profile は regression を通過したものだけ採用
- one-command validation を用意する
- docs と actual config を一致させる

## Required tests
### 実行するコマンド
- `npm run test`
- `npm run test:db`
- `npm run test:workflow`
- `npm run test:integration`
- `npm run test:migrations`
- `npm run test:ranker-gates`
- `npm run test:coe-integrator`
- `npm run test:emotion-regression`
- `npm run eval:smoke`
- `npm run ci:local`

### 検証内容
- quality-first profile が従来品質を維持
- balanced profile が latency 改善を示す
- balanced profile が regression gate を通過
- docs / config / registry alias が一致

## Acceptance criteria
- 2 つの運用プロファイルが定義されている
- quality-first profile の品質が維持されている
- balanced profile の latency 改善が確認できる
- balanced profile が regression gate を通る
- final report で推奨 default が明示される

## Deliverables
- final model profile config
- final benchmark report
- rollout recommendation
- 운영/開発ドキュメント更新

## Dependencies / Next-ticket prerequisites
- **T5 green**
- 最終 ticket

## Stop conditions / Blockers
- balanced profile が regression を通らない
- docs と config が一致しない
- default recommendation を決められない

## Ticket gate
- `npm run ci:local`
- final full command list 全通し

---

# 2. 推奨する最初の着手順

最初にやるべき順番はこれです。

1. **T0** baseline を取る  
2. **T1** alias を分ける  
3. **T2** memory extractor を下げる  
4. **T3** consolidation / maintenance を軽くする  
5. **T4** 残件 cleanup  
6. **T5** decision stack の条件付き評価  
7. **T6** 最終 profile 固定

---

# 3. 要約

## 先に下げる
- memory extractor
- consolidation / reflector / maintenance

## まだ下げない
- generator
- planner
- ranker
- CoE extractor

## 条件付きで後から評価
- planner
- ranker
- CoE extractor

この順番なら、**体験品質をできるだけ守りながら、遅さの主因から安全に削れます。**
