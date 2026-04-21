# yumekano-agent 残件修正プラン（チケット分割版）

## このプランの位置づけ

このプランは、前回のTDDプラン（T0-T9）完了後に**まだ残っている論点だけ**に絞った修正計画です。  
CoE extractor + integrator の本線化、sandbox pair state / working memory の持ち越し、deterministic ranker gate 導入などは完了済みの前提で、**未完了の箇所だけ**を ticket 化しています。

## 現時点の残件サマリ

1. **テストゲートの意味論がまだ甘い**
   - `test:unit` が `npm test` の別名になっており、unit-only ではない
   - `ci:local` に `test:emotion-regression` が入っていない

2. **migration 履歴がまだ冗長・二重**
   - sandbox memory tables が複数 migration で重複定義されている
   - `generator_intimacy_md` / `emotion_appraiser_md` も初期 migration と後段 migration の両方に現れる

3. **legacy comparison が trace にまだ残っていない**
   - `execute-turn.ts` には `enableLegacyComparison` があるが、`legacyComparison` は `null` 固定のまま

4. **prod / draft parity はかなり改善したが、trace persistence の意味論はまだ完全一致でない**
   - prod は専用 trace persistence
   - draft は `playground_turns.trace_json` 更新ベース

5. **legacy in-memory draft path はまだ repo に残っており、canonical publish path の最終封鎖が未完**
   - `src/lib/versioning/drafts.ts` は deprecated だが、active path から完全に外れたことを test で固定できていない

---

# 共通ルール

## 進行ルール

1. **T(n) が green になるまで T(n+1) に進まない**
2. すべてのチケットは **failing tests first**
3. そのチケットの Required tests が全部 green になる
4. Acceptance criteria は pass/fail で判定する
5. fresh DB が required な ticket は、必ず fresh DB で確認する
6. scope が Non-goals に侵入したら一旦止める

## 各チケットの共通完了条件

- [ ] Required tests を追加した
- [ ] Required tests を実行した
- [ ] Required tests がすべて green
- [ ] Acceptance criteria を pass/fail で確認した
- [ ] Stop conditions / Blockers に該当しない

## 共通 Stop conditions

以下のどれかが起きたら、その ticket は **Blocked**。次へ進まない。

- fresh DB で失敗
- schema / repository / migration drift
- required tests 未実装
- prod / draft parity を壊した
- runtime schema canonical を壊した
- CI 相当テストが live model 前提になった
- scope が Non-goals に侵入した
- red のまま「一旦次へ進む」が発生した

---

# 実行順序

- T0. テストゲートの意味論を固定する
- T1. migration の二重定義を整理し、fresh DB / existing DB の両対応を固める
- T2. legacy comparison を実装し、trace に残す
- T3. prod / draft の trace parity を固定する
- T4. canonical publish/versioning path を確定し、legacy draft path を quarantine する
- T5. 最終 gate / rollout / completion 判定

---

# T0. テストゲートの意味論を固定する

**Status**
- [x] Green

## Goal
`test:unit` / `ci:local` / `test` の意味を明確化し、ローカル品質ゲートを「何が green なら次へ進めるか」が分かる状態にする。

## Non-goals
- runtime ロジックの修正
- CoE/PAD ロジック変更
- DB schema 変更
- prompt 内容変更

## Invariants
- 既存 test scripts を無闇に削除しない
- 本番挙動を変えない
- live model 必須の gate を unit/workflow に混ぜない
- regression suite を最終 gate から外さない

## Required tests
### 追加するテスト
- `tests/contracts/test-gate-contract.test.ts`
- `tests/contracts/ci-local-coverage.contract.test.ts`

### 直すべき scripts
- `test:unit` は `npm test` の別名ではなく、unit/contract の最小集合にする
- `ci:local` に **最低でも** `test:emotion-regression` を含める
- `test` は「repo 標準ゲート」だと明確に定義する
- `eval:smoke` の前提を docs に書く

### 実行するコマンド
- `npm run test:unit`
- `npm run test:emotion-regression`
- `npm run ci:local`

## Acceptance criteria
- `test:unit` が `npm test` の別名ではない
- `ci:local` が regression を含む
- `test` / `test:unit` / `test:db` / `test:workflow` / `ci:local` の役割が docs と code で一致する
- 追加テストが scripts の意味論 drift を検知できる
- runtime code に変更が入っていない

## Deliverables
- `package.json` script 修正
- gate semantics short doc
- gate contract tests

## Dependencies / Next-ticket prerequisites
- なし
- **T1 は T0 green まで開始しない**

## Stop conditions / Blockers
- `test:unit` が全体テスト alias のまま
- `ci:local` から regression が抜ける
- docs と scripts の意味が不一致

---

# T1. migration の二重定義を整理し、fresh DB / existing DB の両対応を固める

**Status**
- [x] Green

## Goal
sandbox memory tables と prompt-related columns の migration 履歴を整理し、fresh DB と既存 DB の両方で安全に進む migration contract を確立する。

## Non-goals
- CoE/PAD ロジック変更
- prompt 文面変更
- publish/versioning redesign
- workflow 挙動変更

## Invariants
- fresh DB を壊さない
- existing DB upgrade path を壊さない
- runtime schema を canonical にする
- repository mapping と migration schema を一致させる

## Required tests
### 追加するテスト
- `tests/db/fresh-db.migration-history-cleanup.test.ts`
- `tests/db/existing-db.upgrade-compat.test.ts`
- `tests/contracts/migration-schema.contract.test.ts`

### 検証内容
- fresh DB で migrate 後、sandbox memory tables が canonical な形で存在する
- existing DB 相当の古い状態から upgrade できる
- `generator_intimacy_md` / `emotion_appraiser_md` の列が migration と repo で一致する
- migration の重複定義が実害を生まない、または整理されている

### 実行するコマンド
- `npm run test:db -- tests/db/fresh-db.migration-history-cleanup.test.ts tests/db/existing-db.upgrade-compat.test.ts`
- `npm run test:migrations`
- `npm run ci:local`

## Acceptance criteria
- sandbox memory schema の canonical 定義が 1 つに定まる
- fresh DB migrate が green
- existing DB upgrade path が green
- prompt-related columns の migration / repo / schema drift がない
- migration cleanup 後も seed と workspace init が通る

## Deliverables
- migration 修正
- 必要なら migration comment / docs 補足
- db tests
- contract tests

## Dependencies / Next-ticket prerequisites
- **T0 green**
- **T2 は T1 green まで開始しない**

## Stop conditions / Blockers
- fresh DB red
- existing DB upgrade red
- schema / migration / repository drift が残る
- cleanup が destructive migration に化ける

---

# T2. legacy comparison を実装し、trace に残す

**Status**
- [x] Green

## Goal
`enableLegacyComparison` が有効なとき、legacy path と new CoE path の比較結果を実際に計算し、trace に `legacyComparison` として保存できるようにする。

## Non-goals
- legacy path の完全削除
- rollout default の最終決定
- sandbox parity 修正
- publish/versioning 修正

## Invariants
- new CoE path の mainline を壊さない
- comparison は trace/report 用であり、本番 winner selection を勝手に切り替えない
- comparison オフ時の実行コストと挙動を不用意に悪化させない

## Required tests
### 追加するテスト
- `tests/unit/legacy-comparison.compute.test.ts`
- `tests/workflow/prod-chat-turn.legacy-comparison.integration.test.ts`
- `tests/contracts/trace.legacy-comparison.contract.test.ts`

### 検証内容
- comparison enabled 時に `legacyComparison` が non-null になる
- comparison disabled 時は `legacyComparison` が null または未設定で一貫する
- trace schema が comparison payload を正しく保持する
- comparison result が before/after / delta / explanation を持つ

### 実行するコマンド
- `npm run test:unit -- tests/unit/legacy-comparison.compute.test.ts tests/contracts/trace.legacy-comparison.contract.test.ts`
- `npm run test:workflow -- tests/workflow/prod-chat-turn.legacy-comparison.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- `execute-turn.ts` の `legacyComparison` が null 固定ではない
- comparison enabled/disabled の両方が test で固定される
- trace に comparison payload が保存される
- comparison は new mainline の意思決定を勝手に上書きしない

## Deliverables
- legacy comparison 実装
- trace payload 拡張
- unit/integration/contract tests

## Dependencies / Next-ticket prerequisites
- **T1 green**
- **T3 は T2 green まで開始しない**

## Stop conditions / Blockers
- comparison 実装が mainline behavior を変える
- trace schema と persistence が不一致
- comparison enabled 時に tests が flaky になる

---

# T3. prod / draft の trace parity を固定する

**Status**
- [x] Green

## Goal
state progression だけでなく、**trace persistence と trace shape** についても prod / draft parity を定義し、最低限の一致を固定する。

## Non-goals
- UI redesign
- full trace storage backend の統一
- publish/versioning 整理
- prompt 文体変更

## Invariants
- sandbox は prod data から隔離する
- draft は continuing session state を壊さない
- prod と draft で同じ CoE/integrator core を使う
- trace parity は「完全一致」ではなく、必要な contract を定義する

## Required tests
### 追加するテスト
- `tests/workflow/prod-draft.trace-parity.integration.test.ts`
- `tests/contracts/draft-trace-shape.contract.test.ts`
- `tests/contracts/prod-trace-shape.contract.test.ts`

### 検証内容
- prod trace と draft trace に共通必須フィールドがある
- CoE extraction / emotionTrace / plan / candidates / winnerIndex / memoryWrites の shape が両者で整合する
- draft の trace persistence 方式が no-op で終わらず、`playground_turns.trace_json` に必要 shape を残す
- same fixture sequence で prod/draft trace comparison が通る

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/prod-draft.trace-parity.integration.test.ts`
- `npm run test:unit -- tests/contracts/draft-trace-shape.contract.test.ts tests/contracts/prod-trace-shape.contract.test.ts`
- `npm run ci:local`

## Acceptance criteria
- prod / draft の trace 必須フィールド contract が test で固定される
- draft trace に必要 payload が残る
- prod-draft trace parity test が green
- draft 側の trace persistence semantics が docs/test で説明可能になる

## Deliverables
- trace parity tests
- 必要なら draft trace persistence 修正
- trace contract docs 補足

## Dependencies / Next-ticket prerequisites
- **T2 green**
- **T4 は T3 green まで開始しない**

## Stop conditions / Blockers
- draft trace が pending placeholder のまま
- prod/draft で trace contract がずれる
- parity test が red

---

# T4. canonical publish/versioning path を確定し、legacy draft path を quarantine する

**Status**
- [x] Green

## Goal
workspace-backed draft -> immutable version -> release を唯一の canonical path とし、`src/lib/versioning/drafts.ts` などの legacy in-memory path が active route に使われないことを test で固定する。

## Non-goals
- runtime chat behavior の変更
- CoE/PAD 再調整
- UI 改修
- prompt 文体変更

## Invariants
- fresh DB を壊さない
- canonical path は workspace-backed である
- legacy path を残すなら deprecated/inactive を明示する
- code / docs / tests の canonical path を一致させる

## Required tests
### 追加するテスト
- `tests/workflow/publish.from-workspace.integration.test.ts`
- `tests/workflow/release.activate.integration.test.ts`
- `tests/contracts/legacy-draft-path.quarantine.test.ts`
- `tests/db/fresh-db.publish-smoke.test.ts`

### 検証内容
- workspace draft から publish できる
- fresh DB で publish path が通る
- legacy in-memory draft path が active publish flow から使われていない
- deprecated path の位置づけが docs/test/code で一致する

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/publish.from-workspace.integration.test.ts tests/workflow/release.activate.integration.test.ts`
- `npm run test:db -- tests/db/fresh-db.publish-smoke.test.ts`
- `npm run test:unit -- tests/contracts/legacy-draft-path.quarantine.test.ts`
- `npm run ci:local`

## Acceptance criteria
- canonical publish path が workspace-backed だと test で示せる
- legacy in-memory draft path が active route に残っていない
- fresh DB publish smoke が green
- docs に canonical publish path が明記されている

## Deliverables
- publish/versioning path 整理
- deprecated path quarantine
- publish tests
- docs 更新

## Dependencies / Next-ticket prerequisites
- **T3 green**
- **T5 は T4 green まで開始しない**

## Stop conditions / Blockers
- workspace path と legacy path が並立
- canonical path が docs と code で不一致
- fresh DB publish smoke が red

---

# T5. 最終 gate / rollout / completion 判定

**Status**
- [x] Green

## Goal
すべての local gates を回し、残件ゼロか、残件ありなら blocker を明示したうえで release 判定を行う。

## Non-goals
- 新機能追加
- 大規模アーキテクチャ再設計
- model/provider 再選定
- prompt 再執筆

## Invariants
- hidden blocker を future work に逃がさない
- final report は pass/fail で書く
- legacy/new comparison の rollout 条件を明示する
- complete 判定は gate 結果に基づく

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
- full regression harness
- full DB safety
- workflow/integration suite
- prod/draft trace parity
- legacy comparison behavior
- rollout readiness

## Acceptance criteria
- 上記コマンドがすべて green
- final markdown report が生成される
- release-ready / not-release-ready を pass/fail で宣言できる
- 残 blocker があれば report に列挙されている
- rollout default と comparison mode の扱いが決まっている

## Deliverables
- final regression report
- rollout recommendation
- release-ready 判定
- engineering note

## Dependencies / Next-ticket prerequisites
- **T4 green**
- 最終 ticket

## Stop conditions / Blockers
- local gate のどれか 1 つでも red
- hidden blocker が report に載っていない
- rollout 条件が未定義
- final parity or comparison tests が red

---

# 実装時テンプレート

各 ticket を AI に渡すときは、毎回このテンプレートを使う。

```text
You are working on exactly one ticket in yumekano-agent.

Rules:
- Read only the files relevant to this ticket.
- Do not widen scope.
- Write failing tests first.
- Run the smallest relevant test set after each change.
- Do not move to the next ticket while any required test is red.
- If schema, repository, and migration can drift, add a contract test.
- If the ticket requires fresh DB safety, verify on a fresh DB.
- At the end, report:
  1. files changed
  2. tests added
  3. commands run
  4. pass/fail per acceptance criterion
  5. remaining risks
```

監査用テンプレート:

```text
You are auditing one ticket for yumekano-agent.
Do not edit code.

Check only:
- ticket acceptance criteria
- schema/repository/migration consistency
- fresh DB safety where required
- prod/draft parity impact where required
- missing required tests
- hidden regression risk

Output:
- pass/fail for each acceptance criterion
- concrete blocking issues only
- no redesign suggestions unless they are blockers
```
