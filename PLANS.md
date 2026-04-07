# yumekano-agent 完全修正プラン（段階的TDD / チケットゲート方式）

## このプランの位置づけ

このプランは、既存の改善案を土台にしつつ、**各チケットをテスト駆動で進め、当該チケットの required tests がすべて green になるまで次へ進まない**ように再設計したものです。

現状の repo には、すでに `test` / `test:db` / `test:workflow` / `test:integration` / `test:migrations` / `test:ranker-gates` / `test:coe-integrator` / `test:emotion-regression` / `eval:smoke` / `ci:local` などの scripts が存在します。  
したがって今回の出発点は「テスト基盤をゼロから作る」ではなく、**既存 gate の意味論を整え、チケット順に強制する**ことです。

---

# 0. 全体ルール

## 0.1 進行原則

1. **1 ticket = 1 subsystem**  
   1つのチケットで複数の中核サブシステムをまたがない。

2. **failing tests first**  
   実装の前に、そのチケットの required tests を追加し、まず red を確認する。

3. **smallest green first**  
   まずそのチケット専用の最小テスト集合を green にする。  
   その後、チケット指定の gate を順に回す。

4. **all green before next**  
   そのチケットの Required tests と Acceptance criteria がすべて green / pass になるまで、次チケットへ進まない。

5. **fresh DB must mean fresh DB**  
   DB を含む ticket では、既存ローカル DB を使わず、必ず fresh DB で migrate / seed から確認する。

6. **runtime schema is canonical**  
   prompt / seed / repository / migration / draft persistence / publish flow は runtime schema に合わせる。

7. **prod / draft parity is a contract**  
   parity が必要な領域では、prod と draft のどちらか片方だけ直して次に進まない。

8. **no live-model requirement in core tests**  
   unit / contract / db / workflow integration の中心テストは mocked / deterministic にする。

## 0.2 各チケットで必ず残すログ

各チケット完了時に、必ず次を記録する。

- files changed
- tests added
- commands run
- pass/fail per acceptance criterion
- remaining risks

## 0.3 チケット共通ゲート

各チケットで次へ進んでよいのは、次がすべて満たされた場合だけ。

- [ ] Required tests を追加した
- [ ] Required tests を実行した
- [ ] Required tests がすべて green
- [ ] Acceptance criteria を全て pass/fail 判定した
- [ ] Stop conditions / Blockers に該当しない
- [ ] その ticket 用の最終 gate を回した

## 0.4 共通 Stop conditions

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

# 1. 実行順序

本プランでは、次の順番を固定する。

- T0. 既存テストゲートの意味論修正
- T1. migration / repository / seed contract の完全整合
- T2. prompt contract と override semantics の固定
- T3. CoE contracts / fixtures / regression harness 固定
- T4. CoE extractor + pure integrator を完成
- T5. production execute/chat path を新 core に接続
- T6. draft/playground を stateful にして parity を固定
- T7. generator / ranker の memory path と deterministic gates を完成
- T8. publish/versioning を canonical path に統一
- T9. final gate / rollout / completion 判定

---

# T0. 既存テストゲートの意味論修正

**Status**
- [x] Green

## Goal
既存の test/eval scripts を、チケット駆動開発に使える意味に矯正する。  
「script はあるが、何を保証するかが曖昧」という状態を解消する。

## Non-goals
- emotion / CoE / PAD ロジック変更
- DB schema の意味変更
- prod/draft runtime 挙動変更
- prompt 内容変更

## Invariants
- 既存 test scripts を不用意に削らない
- fresh DB を壊さない
- 本番挙動を変えない
- live model 必須の gate を unit/workflow に混ぜない

## Required tests
### 追加・修正するテスト
- `tests/contracts/test-gate-contract.test.ts`
- `tests/contracts/ci-local-coverage.contract.test.ts`

### 直すべき scripts
- `test:unit` は `npm test` の別名ではなく、unit/contract の最小集合にする
- `ci:local` に **最低でも** `test:emotion-regression` を含める
- `test` は「repo 標準ゲート」だと明確に定義する
- `eval:smoke` の前提を docs に書く

### 実行するコマンド
- `npm run test:unit`
- `npm run test:db`
- `npm run test:workflow`
- `npm run test:emotion-regression`
- `npm run ci:local`

## Acceptance criteria
- `test:unit` が unit/contract のみを指す
- `ci:local` が regression を含む
- `test` / `test:unit` / `test:db` / `test:workflow` / `ci:local` の役割が docs と code で一致する
- 追加テストが scripts の意味論 drift を検知できる
- runtime code を変更していない

## Deliverables
- `package.json` script 修正
- scripts の役割を明記した short doc
- gate contract tests

## Dependencies / Next-ticket prerequisites
- なし
- **T1 は T0 green まで開始しない**

## Stop conditions / Blockers
- `ci:local` が regression を含まない
- `test:unit` が全体テストの別名のまま
- scripts の意味が docs と一致しない

## Ticket gate
この ticket を green にする最終コマンド:
- `npm run ci:local`

---

# T1. migration / repository / seed contract の完全整合

**Status**
- [x] Green

## Goal
`workspace_draft_state`, `prompt_bundle_versions`, `sandbox_*` 周りの schema / migration / repository / seed を完全整合させる。  
特に `generator_intimacy_md`, `emotion_appraiser_md`, sandbox memory tables の重複・後追い migration を整理する。

## Non-goals
- prompt 文面改善
- generator / planner / ranker 応答品質改善
- CoE/PAD ロジック変更
- phase progression 改善

## Invariants
- fresh DB を壊さない
- runtime schema を canonical にする
- 既存 authored prompt の意味を変えない
- prod/draft prompt selection semantics を壊さない

## Required tests
### 追加するテスト
- `tests/contracts/prompt-bundle.persistence.contract.test.ts`
- `tests/contracts/workspace-draft.persistence.contract.test.ts`
- `tests/contracts/sandbox-memory.persistence.contract.test.ts`
- `tests/db/fresh-db.workspace-and-prompt-contract.test.ts`
- `tests/db/fresh-db.sandbox-schema-smoke.test.ts`

### 検証内容
- `promptBundleRepo.create/getById/getLatest/list` が prompt fields を round-trip
- `workspaceRepo.initDraft/getDraft/updateDraftSection/updatePrompt` が prompt fields を round-trip
- sandbox tables が fresh DB で矛盾なく存在する
- migration 重複が整理され、fresh DB と既存 DB の両方で破綻しない
- seed が canonical prompt fields を保存する

### 実行するコマンド
- `npm run test:migrations`
- `npm run test:db -- tests/db/fresh-db.workspace-and-prompt-contract.test.ts tests/db/fresh-db.sandbox-schema-smoke.test.ts`
- `npm run ci:local`

## Acceptance criteria
- `generator_intimacy_md` と `emotion_appraiser_md` の永続化が schema / migration / repository / seed で一致する
- sandbox memory tables の二重定義が解消されるか、少なくとも canonical 定義が 1 つに定まる
- fresh DB migrate -> seed -> workspace init が green
- fresh DB で sandbox session / pair state / working memory を保存できる
- contract tests が red -> green を確認している

## Deliverables
- migration 修正
- repository mapping 修正
- seed 修正
- contract tests
- fresh DB smoke tests

## Dependencies / Next-ticket prerequisites
- **T0 green**
- **T2 は T1 green まで開始しない**

## Stop conditions / Blockers
- schema / repo / migration drift が残る
- fresh DB で SQL error が出る
- sandbox schema が migration ごとに意味不一致
- seed が canonical fields を保存しない

## Ticket gate
- `npm run test:migrations`
- `npm run test:db`
- `npm run ci:local`

---

# T2. prompt contract と override semantics の固定

**Status**
- [x] Green

## Goal
runtime schema を唯一の canonical contract にし、checked-in prompts / seed prompts / `promptOverride` semantics を固定する。

## Non-goals
- persona の大改稿
- model/provider 変更
- CoE/PAD 実装変更
- phase / pair-state の進行改善

## Invariants
- runtime schema が canonical
- `generatorIntimacyMd` 分岐を維持する
- prod / draft の prompt selection behavior を壊さない
- compatibility helper を入れるなら test 付き

## Required tests
### 追加するテスト
- `tests/contracts/planner-prompt.contract.test.ts`
- `tests/contracts/generator-prompt.contract.test.ts`
- `tests/contracts/ranker-prompt.contract.test.ts`
- `tests/contracts/seed-prompt.contract.test.ts`
- `tests/contracts/prompt-override.behavior.test.ts`

### 検証内容
- planner checked-in prompt が `TurnPlanSchema` と一致
- generator checked-in prompt が `candidates[3..5]` を前提
- ranker checked-in prompt が現行 schema と一致
- seed prompts も同じ contract を守る
- `promptOverride` が mandatory rules を消さない
- planner / generator / ranker で override semantics が一貫

### 実行するコマンド
- `npm run test:unit -- tests/contracts/planner-prompt.contract.test.ts tests/contracts/generator-prompt.contract.test.ts tests/contracts/ranker-prompt.contract.test.ts tests/contracts/seed-prompt.contract.test.ts tests/contracts/prompt-override.behavior.test.ts`
- `npm run ci:local`

## Acceptance criteria
- checked-in prompt examples に旧 active contract が残っていない
- seed prompt 群が runtime schema と一致する
- `promptOverride` の意味論がコードとテストで固定されている
- prompt family ごとの drift 防止 test がある
- prod/draft で別 contract を使っていない

## Deliverables
- prompts/ 修正
- seed prompt 修正
- override semantics 修正
- contract tests

## Dependencies / Next-ticket prerequisites
- **T1 green**
- **T3 は T2 green まで開始しない**

## Stop conditions / Blockers
- checked-in prompt と seed prompt が再びずれる
- override semantics が agent ごとに違う
- runtime schema canonical が破れる

## Ticket gate
- `npm run test:unit`
- `npm run ci:local`

---

# T3. CoE contracts / fixtures / regression harness を固定

**Status**
- [x] Green

## Goal
CoE 主導 emotion system の契約と fixture corpus を固定する。  
本番配線の前に、「何を正しい変化とみなすか」を regression として確定する。

## Non-goals
- production への本番配線
- 旧 path の削除
- sandbox の挙動変更
- model/provider 比較

## Invariants
- live model なしで deterministic に回る
- 旧 runtime をまだ壊さない
- fixture は impression でなく band assertion を持つ
- pass/fail 可能な shape で定義する

## Required tests
### 追加するテスト
- `tests/evals/emotion/compliment.fixture.test.ts`
- `tests/evals/emotion/mild-rejection.fixture.test.ts`
- `tests/evals/emotion/explicit-insult.fixture.test.ts`
- `tests/evals/emotion/apology.fixture.test.ts`
- `tests/evals/emotion/repair.fixture.test.ts`
- `tests/evals/emotion/repeated-pressure.fixture.test.ts`
- `tests/evals/emotion/intimacy-positive-context.fixture.test.ts`
- `tests/evals/emotion/intimacy-boundary-crossing.fixture.test.ts`
- `tests/evals/emotion/topic-shift-after-tension.fixture.test.ts`
- `tests/evals/emotion/two-turn-carry-over.fixture.test.ts`
- `tests/evals/emotion/five-turn-progression.fixture.test.ts`
- `tests/contracts/coe-schemas.contract.test.ts`

### 検証内容
各 fixture で最低限検証する。
- CoE evidence shape
- relational appraisal axes
- PAD delta band
- pair metric delta band

### 実行するコマンド
- `npm run test:unit -- tests/contracts/coe-schemas.contract.test.ts`
- `npm run test:emotion-regression`
- `npm run eval:smoke`
- `npm run ci:local`

## Acceptance criteria
- CoE / appraisal / delta / trace の schema/type が存在する
- required fixtures が全部ある
- 各 fixture が evidence / axes / PAD delta / pair metrics を検証する
- live model 必須でない
- regression harness が repo 標準 gate に含まれている

## Deliverables
- 新 schema/type 群
- fixture corpus
- regression harness
- eval runner の最小補強

## Dependencies / Next-ticket prerequisites
- **T2 green**
- **T4 は T3 green まで開始しない**

## Stop conditions / Blockers
- fixture が impression 評価だけ
- live model 必須
- evidence / appraisal / delta のどれかが未定義
- regression が `ci:local` から漏れている

## Ticket gate
- `npm run test:emotion-regression`
- `npm run eval:smoke`
- `npm run ci:local`

---

# T4. CoE extractor + pure integrator を完成

**Status**
- [x] Green

## Goal
`user text -> CoE evidence -> relational appraisal -> PAD / pair delta` の pure core を完成させる。

## Non-goals
- prod/draft への本番配線
- publish/versioning 整理
- UI 改修
- prompt 文体改善

## Invariants
- new main path に regex pattern matching を戻さない
- hard safety / consent / abuse の narrow override だけ deterministic に残す
- weights は config / emotion spec から読む
- integrator を workflow glue に埋めない

## Required tests
### 追加するテスト
- `tests/unit/coe-extractor.mocked.test.ts`
- `tests/unit/coe-extractor.parse-repair.test.ts`
- `tests/unit/relational-integrator.insult-shock.test.ts`
- `tests/unit/relational-integrator.apology-repair.test.ts`
- `tests/unit/relational-integrator.sustained-pressure.test.ts`
- `tests/unit/relational-integrator.affectionate-carry-over.test.ts`
- `tests/unit/relational-integrator.quiet-turn-decay.test.ts`
- `tests/unit/relational-integrator.open-thread-bias.test.ts`
- `tests/unit/legacy-comparison.trace-shape.test.ts`

### 検証内容
- extractor input に必要 context が入る
- malformed output を strict parse / repair / fail-fast で扱える
- integrator が CoE appraisal を入力に PAD delta と pair metric delta を返す
- legacy comparison 用の shape を trace に残せる
- old heuristic path は adapter / flag の内側に閉じる

### 実行するコマンド
- `npm run test:coe-integrator`
- `npm run test:unit -- tests/unit/coe-extractor.mocked.test.ts tests/unit/coe-extractor.parse-repair.test.ts tests/unit/legacy-comparison.trace-shape.test.ts`
- `npm run ci:local`

## Acceptance criteria
- dedicated CoE extractor module がある
- dedicated relational integrator module がある
- malformed model output handling が code と test で定義されている
- new main path が regex 依存でない
- legacy comparison shape が trace 契約として定義される

## Deliverables
- CoE extractor module
- relational integrator module
- adapter / feature flag
- mocked tests
- legacy comparison trace contract

## Dependencies / Next-ticket prerequisites
- **T3 green**
- **T5 は T4 green まで開始しない**

## Stop conditions / Blockers
- integrator が workflow 側に埋まる
- regex main path が残る
- malformed output handling 未定義
- legacy comparison shape が null 前提のまま

## Ticket gate
- `npm run test:coe-integrator`
- `npm run ci:local`

---

# T5. production path を新 core に接続

**Status**
- [x] Green

## Goal
production `executeTurn/runChatTurn` を new CoE path に接続し、phase / pair metrics / trace を整合させる。

## Non-goals
- sandbox 修正
- publish/versioning 整理
- model/provider 比較
- prompt 文体調整

## Invariants
- fresh DB を壊さない
- runtime schema canonical を守る
- trace persistence を壊さない
- retrieval / writeback を壊さない

## Required tests
### 追加するテスト
- `tests/workflow/prod-chat-turn.one-turn.integration.test.ts`
- `tests/workflow/prod-chat-turn.three-turn.integration.test.ts`
- `tests/workflow/prod-chat-turn.phase-transition.integration.test.ts`
- `tests/workflow/prod-chat-turn.pair-state-persistence.integration.test.ts`
- `tests/workflow/prod-chat-turn.trace.integration.test.ts`
- `tests/workflow/prod-chat-turn.legacy-comparison.integration.test.ts`

### 検証内容
- production main path が legacy appraisal 直呼びでない
- elapsed / counters / phase context が導出可能な実値になる
- `pairRepo.updateState` が trust / affinity / intimacyReadiness / conflict / PAD を保存
- trace に CoE evidence / appraisal / deltas / legacyComparison が残る
- `enableLegacyComparison` が有効時に比較結果が null でない

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/prod-chat-turn.one-turn.integration.test.ts tests/workflow/prod-chat-turn.three-turn.integration.test.ts`
- `npm run test:workflow -- tests/workflow/prod-chat-turn.phase-transition.integration.test.ts tests/workflow/prod-chat-turn.pair-state-persistence.integration.test.ts tests/workflow/prod-chat-turn.trace.integration.test.ts tests/workflow/prod-chat-turn.legacy-comparison.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- production path が new CoE path を使う
- phase/context placeholder が導出可能な範囲で実値に置換される
- pair metrics が永続化される
- trace に new reasoning と legacyComparison が入る
- required integration tests が green

## Deliverables
- `execute-turn.ts` / `chat-turn.ts` 修正
- trace 拡張
- pair-state persistence 修正
- integration tests

## Dependencies / Next-ticket prerequisites
- **T4 green**
- **T6 は T5 green まで開始しない**

## Stop conditions / Blockers
- placeholder logic が残る
- pair metrics が一部しか保存されない
- trace に legacyComparison が残らない
- prod path が still mixed / partial

## Ticket gate
- `npm run test:workflow`
- `npm run ci:local`

---

# T6. draft/playground を stateful にして parity を固定

**Status**
- [x] Green

## Goal
sandbox tables を本当に使い、draft/playground を continuing-session ベースの stateful workflow にする。  
同じ fixture sequence に対する prod/draft の parity を test で固定する。

## Non-goals
- publish/versioning 整理
- editor UI の大改修
- model tuning
- persona 修正

## Invariants
- sandbox は prod data と隔離
- sandbox 自身の state は消さない
- prod と同じ CoE/integrator core を使う
- explicit reset は残すが implicit reset は消す

## Required tests
### 追加するテスト
- `tests/workflow/draft-chat-turn.sandbox-pair-state.integration.test.ts`
- `tests/workflow/draft-chat-turn.sandbox-working-memory.integration.test.ts`
- `tests/workflow/draft-chat-turn.multi-turn.integration.test.ts`
- `tests/workflow/draft-chat-turn.explicit-reset.integration.test.ts`
- `tests/workflow/prod-draft.parity.integration.test.ts`
- `tests/workflow/prod-draft.trace-parity.integration.test.ts`

### 検証内容
- continuing session で baseline reset しない
- sandbox pair state / working memory を持ち越す
- `phaseIdAfter` が固定でない
- prod と draft の state progression が parity を持つ
- trace shape の最低限の parity がある

### 実行するコマンド
- `npm run test:draft-chat-stateful`
- `npm run test:workflow -- tests/workflow/prod-draft.parity.integration.test.ts tests/workflow/prod-draft.trace-parity.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- draft/playground が PAD を持ち越す
- pair metrics を持ち越す
- sandbox working memory を持ち越す
- `phaseIdAfter` が固定値ではない
- parity tests が green

## Deliverables
- sandbox repo CRUD 完成
- `draft-chat-turn.ts` 修正
- parity tests
- reset semantics

## Dependencies / Next-ticket prerequisites
- **T5 green**
- **T7 は T6 green まで開始しない**

## Stop conditions / Blockers
- sandbox tables が delete 以外で未使用
- baseline reset が残る
- prod/draft で別 core を呼ぶ
- parity tests が red

## Ticket gate
- `npm run test:draft-chat-stateful`
- `npm run test:workflow`
- `npm run ci:local`

---

# T7. generator / ranker の memory path と deterministic gates を完成

**Status**
- [x] Green

## Goal
generator と ranker に retrieved memory を正しく通し、deterministic gates を model ranking の前に固定する。

## Non-goals
- prompt 文体の微調整
- provider/model 変更
- publish/versioning 修正
- UI 改修

## Invariants
- generator/ranker の memory 入力は prod/draft 同 shape
- deterministic gates は model scoring より前に走る
- `memoryGrounding` を、見えていない memory で採点させない
- hard reject は code path で実装する

## Required tests
### 追加するテスト
- `tests/contracts/generator-memory-context.contract.test.ts`
- `tests/contracts/ranker-memory-context.contract.test.ts`
- `tests/unit/ranker-gates.phase-violation.test.ts`
- `tests/unit/ranker-gates.intimacy-violation.test.ts`
- `tests/unit/ranker-gates.memory-contradiction.test.ts`
- `tests/unit/ranker-gates.coe-contradiction.test.ts`
- `tests/unit/ranker-gates.hard-safety.test.ts`
- `tests/workflow/ranker.integration.test.ts`

### 検証内容
- generator user prompt/context が facts / events / threads / observations を見ている
- ranker input が memoryGrounding に必要な context を持つ
- deterministic gates が model ranking 前に動く
- rejected candidates が model judgement に進まない
- surviving candidates だけが model ranking に進む

### 実行するコマンド
- `npm run test:ranker-gates`
- `npm run test:unit -- tests/contracts/generator-memory-context.contract.test.ts tests/contracts/ranker-memory-context.contract.test.ts`
- `npm run test:workflow -- tests/workflow/ranker.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- generator が retrieved memory を使う
- ranker が memoryGrounding に必要な memory context を使う
- deterministic gates が code path として存在する
- gates の unit tests が green
- workflow ranker integration test が green

## Deliverables
- generator memory-context 修正
- ranker deterministic gate layer
- memory-context contract tests
- ranker tests

## Dependencies / Next-ticket prerequisites
- **T6 green**
- **T8 は T7 green まで開始しない**

## Stop conditions / Blockers
- generator/ranker が facts/events を見ない
- deterministic gates が prompt 文面にしか存在しない
- gate coverage が不足
- prod/draft の入力 shape がずれる

## Ticket gate
- `npm run test:ranker-gates`
- `npm run ci:local`

---

# T8. publish/versioning を canonical path に統一

**Status**
- [x] Green

## Goal
workspace-backed draft を唯一の canonical authoring source にし、legacy in-memory draft/publish path を quarantine する。

## Non-goals
- runtime chat behavior の変更
- editor UI redesign
- CoE/PAD 再調整
- prompt 文体変更

## Invariants
- fresh DB を壊さない
- workspace draft -> immutable version -> release を canonical にする
- legacy path を残すなら inactive/deprecated を明示
- docs と code の canonical path を一致させる

## Required tests
### 追加するテスト
- `tests/workflow/publish.from-workspace.integration.test.ts`
- `tests/workflow/versioning.create-version.integration.test.ts`
- `tests/workflow/release.activate.integration.test.ts`
- `tests/db/fresh-db.publish-smoke.test.ts`
- `tests/contracts/legacy-draft-path.quarantine.test.ts`

### 検証内容
- workspace draft から publish -> version -> release activation ができる
- fresh DB で publish flow が通る
- legacy in-memory draft path が active route から外れている
- canonical path が docs と一致する

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/publish.from-workspace.integration.test.ts tests/workflow/versioning.create-version.integration.test.ts tests/workflow/release.activate.integration.test.ts`
- `npm run test:db -- tests/db/fresh-db.publish-smoke.test.ts`
- `npm run test:unit -- tests/contracts/legacy-draft-path.quarantine.test.ts`
- `npm run ci:local`

## Acceptance criteria
- active code path に legacy in-memory publish flow が残っていない
- workspace draft から publish できる
- fresh DB publish smoke が green
- docs に canonical publish flow が明記されている
- legacy path の位置づけが code/test/doc で一致する

## Deliverables
- publish path 整理
- deprecated path の削除または quarantine
- publish integration tests
- docs 更新

## Dependencies / Next-ticket prerequisites
- **T7 green**
- **T9 は T8 green まで開始しない**

## Stop conditions / Blockers
- workspace と in-memory publish が並立
- canonical path が docs と code で不一致
- publish が fresh DB で通らない

## Ticket gate
- `npm run test:db`
- `npm run test:workflow`
- `npm run ci:local`

---

# T9. final gate / rollout / completion 判定

**Status**
- [x] Green

## Goal
すべての local gate を回し、legacy/new emotion path の切替と rollout default を最終決定する。  
「完璧に治ったか」を **pass/fail で宣言**できる状態にする。

## Non-goals
- 新アーキテクチャ追加
- 大規模 prompt 再設計
- model/provider 再選定
- 新 feature 追加

## Invariants
- hidden blocker を future work に逃がさない
- final report は pass/fail で書く
- legacy path を残すなら feature flag で管理
- completion 判定は gate 結果に基づく

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
- full DB smoke
- full workflow/integration suite
- final prod/draft parity
- rollout flag behavior
- legacyComparison behavior

## Acceptance criteria
- 上記コマンドがすべて green
- final markdown report が生成される
- legacy/new emotion path の default flag が決まっている
- remaining blockers がある場合は report に明示されている
- “complete / not complete” を pass/fail で宣言できる

## Deliverables
- final regression report
- rollout recommendation
- feature-flag default decision
- engineering/release note

## Dependencies / Next-ticket prerequisites
- **T8 green**
- 最終 ticket

## Stop conditions / Blockers
- local gate のどれか 1 つでも red
- hidden blocker が report に載っていない
- legacy/new 切替条件が未定義
- final parity が red

## Ticket gate
- `npm run ci:local`
- final full command list 全通し

---

# 2. 実装時の運用テンプレート

各 ticket を AI に渡すときは、このテンプレートを使う。

```text
You are working on exactly one ticket in yumekano-agent.

Rules:
- Read only the files relevant to this ticket.
- Do not widen scope.
- Write failing tests first.
- After each change, run the smallest relevant test set.
- Do not move to the next ticket while any required test is red.
- If schema, repository, and migration can drift, add a contract test.
- If a ticket requires fresh DB safety, verify on a fresh DB.
- Do not remove legacy behavior unless the ticket explicitly says so.
- At the end, report:
  1. files changed
  2. tests added
  3. commands run
  4. pass/fail per acceptance criterion
  5. remaining risks
```

監査役 AI には次を使う。

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

---

# 3. 最後に

このプランの本質は、**「良さそうに直す」のではなく、契約を固定して gate を作り、green になったら次へ進む**ことです。  
特に今回の repo では、すでに test/eval scripts 自体は存在するため、重要なのは **順番** と **gate の意味** です。

- 先に gate を整える
- 次に persistence / contract を閉じる
- そのあと CoE core を固定する
- そのあと prod
- 次に draft parity
- 最後に ranker / publish / rollout を閉じる

これを守れば、「一度直したのに別層で壊れる」をかなり防げます。
