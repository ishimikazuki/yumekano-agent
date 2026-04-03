# yumekano-agent 改善実装プラン

## 目的

このプランは、修正を **チケット単位** に分割し、**各チケットで必須テストを追加・実行し、すべて green になったら次へ進む**ための実行計画です。

いまのレビューで優先度が高い論点は次のとおりです。

- `package.json` に標準の `test` / `test:db` / `test:workflow` / `eval:smoke` がなく、品質ゲートが固定化されていない。
- `workspace_draft_state` と `prompt_bundle_versions` の `generatorIntimacyMd` 永続化が schema / migration / repository で揃っていない。
- emotion の本線がまだ `computeAppraisal -> updatePAD` の heuristic path で、CoE は説明レイヤー寄り。
- production `chat_turn` は elapsed / phase context / pair metrics の更新が不十分。
- draft/playground は continuing session でも baseline ベースの振る舞いが残り、prod/draft parity が弱い。
- checked-in prompts / seed prompts / runtime schema に drift が残っている。
- ranker は deterministic gate より前に model 判定へ寄っている。
- publish/versioning の canonical path が二重化している。

---

## 実行原則

### 進行ルール

1. **T(n) が green になるまで T(n+1) に進まない。**
2. 各チケットは **failing tests first** で始める。
3. 各チケットの最後に、**Required tests** と **Acceptance criteria** を pass/fail で確認する。
4. 各チケットの最後に、最低でも次を記録する。
   - files changed
   - tests added
   - commands run
   - pass/fail per acceptance criterion
   - remaining risks
5. `fresh DB` を使うべきチケットでは、既存ローカル DB ではなく **まっさらな DB で migrate/seed から検証**する。
6. runtime schema を canonical contract とし、prompt / seed / repo mapping / migration はそこへ合わせる。
7. prod と draft が同じ中核ロジックを使うべき箇所では、**片方だけ直して進まない**。
8. live model が不要なテストは、必ず mocked / deterministic にする。

### 進行ゲート

各チケットで次に進んでよい条件は、次の 4 つがすべて満たされたときだけです。

- [ ] Required tests をすべて追加した
- [ ] Required tests をすべて実行し green になった
- [ ] Acceptance criteria をすべて pass した
- [ ] Stop conditions / Blockers に該当しない

### 失敗時の原則

以下のどれかが起きたら、そのチケットは **Blocked** とし、次へ進まないこと。

- fresh DB で失敗
- schema / repository / migration drift
- required tests 未実装
- prod / draft parity を壊した
- runtime schema canonical を壊した
- live model がないと CI が回らない
- scope が広がって当該チケットの Non-goals に侵入した

---

# T0. ローカル品質ゲートの新設

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
repo に標準のテスト / eval エントリポイントを追加し、以後の修正をすべて **同じ品質ゲート** で回せる状態にする。

## Non-goals
- emotion / CoE / PAD ロジックの修正
- prompt 内容の改善
- DB schema の意味変更
- prod/draft の runtime 挙動変更

## Invariants
- fresh DB を壊さない
- live model 必須の unit / workflow test を作らない
- 本 ticket では本番挙動を変更しない
- 後続 ticket が「最小 relevant subset」と「full local gate」の両方を使える構成にする

## Required tests
### 追加するテスト
- `tests/db/fresh-db.migrate-smoke.test.ts`
- `tests/db/fresh-db.seed-smoke.test.ts`
- `tests/workflow/chat-turn.smoke.test.ts`（mocked）
- `tests/contracts/.keep` または空雛形

### 追加する scripts
- `test`
- `test:unit`
- `test:db`
- `test:workflow`
- `eval:smoke`
- `ci:local`

### 実行するコマンド
- `npm run test:db`
- `npm run test:workflow`
- `npm run test`
- `npm run ci:local`

## Acceptance criteria
- `package.json` に上記 scripts が存在する
- テストランナーと設定ファイルがコミットされている
- `npm run test:db` で fresh DB migrate/seed smoke が実行される
- `npm run test:workflow` で mocked workflow smoke が最低 1 本通る
- 本 ticket の diff が emotion / planner / generator / ranker / workflow の本番ロジックを変更していない

## Deliverables
- テストランナー導入
- テスト設定ファイル
- `package.json` scripts
- DB smoke tests
- mocked workflow smoke tests
- `ci:local` コマンド

## Dependencies / Next-ticket prerequisites
- なし
- **T1 は T0 が green になるまで開始しない**

## Stop conditions / Blockers
- テストランナーが live model 前提になる
- fresh DB smoke が作れない
- 本番 runtime まで広く変更し始めた
- `test` / `test:db` / `ci:local` が未完成のまま次へ進もうとしている

---

# T1. `generatorIntimacyMd` の persistence contract を完全修正する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
`workspace_draft_state` と `prompt_bundle_versions` を、schema / migration / repository / seed の全層で `generatorIntimacyMd` に一致させる。

## Non-goals
- prompt の文章改善
- generator の応答品質改善
- CoE / PAD ロジック変更
- phase / pair-state の進行改善

## Invariants
- fresh DB を壊さない
- runtime schema を canonical にする
- 既存の non-intimacy prompt 挙動を変えない
- prod/draft の prompt selection semantics を壊さない

## Required tests
### 追加するテスト
- `tests/contracts/prompt-bundle.generator-intimacy.contract.test.ts`
- `tests/contracts/workspace-draft.generator-intimacy.contract.test.ts`
- `tests/db/fresh-db.workspace-prompt-contract.test.ts`

### 検証内容
- `promptBundleRepo.create/getById/getLatest/list` が `generatorIntimacyMd` を round-trip する
- `workspaceRepo.initDraft/getDraft/updateDraftSection/updatePrompt` が `generatorIntimacyMd` を round-trip する
- fresh DB で migrate -> seed -> workspace init -> prompt update が通る
- prod / draft の `selectGeneratorPrompt` が authored `generatorIntimacyMd` を取得できる

### 実行するコマンド
- `npm run test:unit -- tests/contracts/prompt-bundle.generator-intimacy.contract.test.ts tests/contracts/workspace-draft.generator-intimacy.contract.test.ts`
- `npm run test:db -- tests/db/fresh-db.workspace-prompt-contract.test.ts`
- `npm run ci:local`

## Acceptance criteria
- `workspace_draft_state` に `generator_intimacy_md` 列が存在する
- `prompt_bundle_versions` に `generator_intimacy_md` 列が存在する
- schema / migration / repository / seed がその列名と意味で一致している
- fresh DB smoke が green
- `generatorIntimacyMd` が prod / draft の両方で authored value として取得できる

## Deliverables
- migration 修正
- repo mapping 修正
- seed 修正
- contract tests
- fresh DB smoke test

## Dependencies / Next-ticket prerequisites
- **T0 green**
- **T2 は T1 が green になるまで開始しない**

## Stop conditions / Blockers
- schema / repo / migration の drift が 1 箇所でも残る
- fresh DB で SQL column error が出る
- seed が `generatorIntimacyMd` を保存しない
- prod / draft のどちらかだけが authored intimacy prompt を見える状態になる

---

# T2. prompt contract の canonical source を一本化する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
runtime schema を唯一の canonical contract にし、checked-in prompts / seed prompts / override semantics をそれに揃える。

## Non-goals
- persona の大改稿
- model/provider の変更
- CoE / PAD 実装変更
- ranking ロジックの大変更

## Invariants
- runtime schema を canonical にする
- `generatorIntimacyMd` 分岐を維持する
- prod / draft の prompt selection behavior を壊さない
- compatibility helper を入れるなら test 付きで明示する

## Required tests
### 追加するテスト
- `tests/contracts/planner-prompt.contract.test.ts`
- `tests/contracts/generator-prompt.contract.test.ts`
- `tests/contracts/ranker-prompt.contract.test.ts`
- `tests/contracts/seed-prompt.contract.test.ts`
- `tests/contracts/prompt-override.behavior.test.ts`

### 検証内容
- planner checked-in prompt が `TurnPlanSchema` と一致する
- generator checked-in prompt が `candidates[3..5]` を前提にする
- ranker checked-in prompt が `globalNotes: string` 等の現行 schema と一致する
- seed prompts が checked-in prompt と同じ contract を守る
- `promptOverride` が mandatory rules を消さない

### 実行するコマンド
- `npm run test:unit -- tests/contracts/planner-prompt.contract.test.ts tests/contracts/generator-prompt.contract.test.ts tests/contracts/ranker-prompt.contract.test.ts tests/contracts/seed-prompt.contract.test.ts tests/contracts/prompt-override.behavior.test.ts`
- `npm run ci:local`

## Acceptance criteria
- checked-in prompt examples に旧 field 名が active example として残っていない
- seed prompt 群が runtime schema と一致する
- planner / generator / ranker の prompt family ごとに drift 防止 contract test がある
- `promptOverride` の意味論がコードとテストで固定されている
- canonical contract が runtime schema であることが docs / tests / code で一致している

## Deliverables
- prompts/ 修正
- seed prompt 修正
- promptOverride semantics 修正
- contract tests
- 必要なら compatibility helper

## Dependencies / Next-ticket prerequisites
- **T1 green**
- **T3 は T2 が green になるまで開始しない**

## Stop conditions / Blockers
- checked-in prompt と seed prompt の片方だけ直る
- schema と prompt example が再びずれる
- override semantics が曖昧なまま残る
- prod/draft で別 contract を使い始める

---

# T3. CoE 契約と回帰フィクスチャを先に定義する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
CoE 主導 emotion system の型契約と fixture corpus を先に作る。  
本番配線の前に、**何を正解とみなすか** を test で固定する。

## Non-goals
- production workflow への配線
- 旧 heuristic appraisal path の削除
- sandbox の挙動変更
- model/provider 比較

## Invariants
- live model なしで deterministic に回る
- 旧 runtime をまだ壊さない
- fixture は impression ではなく band assertion を持つ
- pass/fail ができる shape で定義する

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
各 fixture で少なくとも以下を assert する。
- CoE evidence shape
- relational appraisal axes
- PAD delta band
- pair metric delta band

### 実行するコマンド
- `npm run test:unit -- tests/contracts/coe-schemas.contract.test.ts`
- `npm run eval:smoke -- tests/evals/emotion`
- `npm run ci:local`

## Acceptance criteria
- `CoEEvidence`, `RelationalAppraisal`, `EmotionUpdateProposal`, `PairMetricDelta`, `EmotionTrace` の schema/type が存在する
- required fixture がすべてコミットされている
- 各 fixture が evidence / axes / PAD delta / pair metric delta を検証している
- 本番 workflow はまだ旧 path のまま
- テストが deterministic で live model を要求しない

## Deliverables
- 新 schema/type 群
- fixture corpus
- regression harness
- eval 実行用の最低限の runner 補強

## Dependencies / Next-ticket prerequisites
- **T2 green**
- **T4 は T3 が green になるまで開始しない**

## Stop conditions / Blockers
- fixture が文章の印象評価だけになっている
- live model 必須のテストになる
- evidence / appraisal / delta のいずれかが未定義
- 本番配線を先に触り始めた

---

# T4. CoE extractor と pure integrator を作る

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
`user text -> CoE evidence -> relational appraisal -> PAD / pair delta` の pure core を実装する。

## Non-goals
- prod / draft への本番配線
- phase progression の修正
- publish/versioning の整理
- prompt 文面の再設計

## Invariants
- 新 path の main logic に regex pattern matching を戻さない
- hard safety / consent / abuse の narrow override だけ deterministic に残す
- weights は config / emotion spec から読む
- pure core は workflow glue に埋め込まない

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

### 検証内容
- extractor input に必要 context が入る
- malformed model output を strict parse / repair / fail-fast で扱える
- integrator が CoE appraisal を入力に PAD delta と pair metric delta を返す
- legacy path を adapter / flag の内側に隔離できる

### 実行するコマンド
- `npm run test:unit -- tests/unit/coe-extractor.mocked.test.ts tests/unit/coe-extractor.parse-repair.test.ts`
- `npm run test:unit -- tests/unit/relational-integrator.*.test.ts`
- `npm run ci:local`

## Acceptance criteria
- dedicated CoE extractor module がある
- dedicated relational integrator module がある
- new path は regex message matching を main path に使わない
- malformed model output handling が code と test で定義されている
- required unit tests が green

## Deliverables
- CoE extractor module
- relational integrator module
- adapter / feature flag
- mocked tests
- config/spec ベースの weighting

## Dependencies / Next-ticket prerequisites
- **T3 green**
- **T5 は T4 が green になるまで開始しない**

## Stop conditions / Blockers
- integrator が workflow に埋まる
- regex main path が残る
- malformed output の扱いが未定義
- weights が workflow 側の magic number に残る

---

# T5. production `chat_turn` を新 core に配線し、state progression を直す

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
production `runChatTurn` を new CoE path に切り替え、pair metrics / phase inputs / trace を設計どおりに近づける。

## Non-goals
- sandbox 修正
- publish/versioning 修正
- model/provider 比較
- prompt 文体調整

## Invariants
- fresh DB を壊さない
- runtime schema canonical を守る
- extractor / trace persistence を壊さない
- new core を workflow に正しく接続するが、不要な周辺設計変更はしない

## Required tests
### 追加するテスト
- `tests/workflow/prod-chat-turn.one-turn.integration.test.ts`
- `tests/workflow/prod-chat-turn.three-turn.integration.test.ts`
- `tests/workflow/prod-chat-turn.phase-transition.integration.test.ts`
- `tests/workflow/prod-chat-turn.pair-state-persistence.integration.test.ts`
- `tests/workflow/prod-chat-turn.trace.integration.test.ts`

### 検証内容
- production main path が `computeAppraisal` 直呼びではない
- elapsed / counters / phase context が固定 placeholder ではなく、導出可能な実値を使う
- `pairRepo.updateState` が trust / affinity / intimacyReadiness / conflict / PAD を保存する
- trace に CoE evidence / appraisal / state deltas が残る

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/prod-chat-turn.one-turn.integration.test.ts tests/workflow/prod-chat-turn.three-turn.integration.test.ts`
- `npm run test:workflow -- tests/workflow/prod-chat-turn.phase-transition.integration.test.ts tests/workflow/prod-chat-turn.pair-state-persistence.integration.test.ts tests/workflow/prod-chat-turn.trace.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- production `chat_turn` の本線が new CoE path を使う
- `turnsSinceLastUpdate: 1` の固定がなくなる
- `events: new Map()`, `topics: new Map()`, zero counter placeholder が、導出可能な範囲で実値に置き換わる
- pair metrics が DB に保存される
- trace に新しい state reasoning が残る
- required workflow integration tests が green

## Deliverables
- `chat-turn.ts` 修正
- trace 拡張
- pair-state persistence 修正
- integration tests

## Dependencies / Next-ticket prerequisites
- **T4 green**
- **T6 は T5 が green になるまで開始しない**

## Stop conditions / Blockers
- placeholder logic が残る
- pair metrics が一部しか保存されない
- trace に evidence / appraisal / delta が残らない
- new core が production path に未接続

---

# T6. draft/playground を stateful にし、prod/draft parity を作る

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
sandbox tables を本当に使い、draft/playground を continuing-session ベースの stateful workflow にする。  
prod と同じ core を使い、**prod/draft parity** をテストで固定する。

## Non-goals
- publish/versioning の整理
- editor UI の大改修
- model tuning
- persona の修正

## Invariants
- sandbox は prod data から隔離する
- sandbox 自身の session state は毎ターン消さない
- prod と同じ CoE / integrator core を使う
- explicit reset を残すが implicit reset は消す

## Required tests
### 追加するテスト
- `tests/workflow/draft-chat-turn.sandbox-pair-state.integration.test.ts`
- `tests/workflow/draft-chat-turn.sandbox-working-memory.integration.test.ts`
- `tests/workflow/draft-chat-turn.multi-turn.integration.test.ts`
- `tests/workflow/draft-chat-turn.explicit-reset.integration.test.ts`
- `tests/workflow/prod-draft.parity.integration.test.ts`

### 検証内容
- continuing session で baseline PAD / default pair state に自動リセットしない
- `sandbox_pair_state` と `sandbox_working_memory` の read/write CRUD がある
- draft planner / generator / ranker が empty memory/openThreads に固定依存しない
- `phaseIdAfter` が固定値ではない
- 同じ fixture sequence に対して prod/draft の state progression が整合する

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/draft-chat-turn.sandbox-pair-state.integration.test.ts tests/workflow/draft-chat-turn.sandbox-working-memory.integration.test.ts`
- `npm run test:workflow -- tests/workflow/draft-chat-turn.multi-turn.integration.test.ts tests/workflow/draft-chat-turn.explicit-reset.integration.test.ts tests/workflow/prod-draft.parity.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- draft/playground が PAD を session across turns で持ち越す
- draft/playground が pair metrics を持ち越す
- draft/playground が sandbox working memory を持ち越す
- draft の `phaseIdAfter` が固定ではない
- parity test が green

## Deliverables
- sandbox repo CRUD
- `draft-chat-turn.ts` 修正
- parity tests
- reset semantics 明確化

## Dependencies / Next-ticket prerequisites
- **T5 green**
- **T7 は T6 が green になるまで開始しない**

## Stop conditions / Blockers
- sandbox tables が delete でしか使われない
- continuing session でも baseline reset が残る
- prod/draft で別 core を呼ぶ
- parity test が未実装または red

---

# T7. generator / ranker の memory path と deterministic gates を完成させる

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
generator と ranker に retrieved memory を正しく通し、LLM ranker の前に deterministic reject を置く。

## Non-goals
- prompt 文体の微調整
- provider/model 変更
- publish/versioning 修正
- UI 改修

## Invariants
- generator/ranker の memory 入力は prod/draft で同じ shape にする
- deterministic gates は model scoring より前に走る
- `memoryGrounding` を、見えていない memory で採点させない
- hard reject は prompt 文章ではなく code path として実装する

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
- generator が facts / events / threads /必要なら observations summary を見ている
- ranker が memoryGrounding に必要な memory context を実際に見ている
- gate で落ちる候補が model 判定に進まない
- surviving candidate だけが model-based ranking に進む

### 実行するコマンド
- `npm run test:unit -- tests/contracts/generator-memory-context.contract.test.ts tests/contracts/ranker-memory-context.contract.test.ts`
- `npm run test:unit -- tests/unit/ranker-gates.*.test.ts`
- `npm run test:workflow -- tests/workflow/ranker.integration.test.ts`
- `npm run ci:local`

## Acceptance criteria
- generator prompt/context が retrieved memory を使う
- ranker input が memoryGrounding に必要な context を持つ
- deterministic gates が code path として存在する
- reject された候補は model judgement 前に落ちる
- required tests が green

## Deliverables
- generator memory-context 修正
- ranker deterministic gate layer
- prompt-context contract tests
- ranker tests

## Dependencies / Next-ticket prerequisites
- **T6 green**
- **T8 は T7 が green になるまで開始しない**

## Stop conditions / Blockers
- generator/ranker が memoryGrounding を名乗りつつ facts/events を見ない
- deterministic gates が prompt 文面にしか存在しない
- gate coverage が不足する
- prod/draft で入力 shape がずれる

---

# T8. publish/versioning を DB-backed workspace path に統一する

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
workspace draft を唯一の canonical authoring source にし、in-memory draft/publish path を整理する。

## Non-goals
- runtime chat behavior の変更
- editor UI redesign
- CoE / PAD の再調整
- prompt 文体変更

## Invariants
- fresh DB を壊さない
- workspace DB draft -> immutable version -> release の流れを canonical にする
- 旧 path を残すなら inactive/deprecated を明示する
- docs と code の canonical path を一致させる

## Required tests
### 追加するテスト
- `tests/workflow/publish.from-workspace.integration.test.ts`
- `tests/workflow/versioning.create-version.integration.test.ts`
- `tests/workflow/release.activate.integration.test.ts`
- `tests/db/fresh-db.publish-smoke.test.ts`

### 検証内容
- workspace draft から publish して immutable version を作れる
- release activation ができる
- fresh DB で publish flow が通る
- in-memory path が active code path から外れる

### 実行するコマンド
- `npm run test:workflow -- tests/workflow/publish.from-workspace.integration.test.ts tests/workflow/versioning.create-version.integration.test.ts tests/workflow/release.activate.integration.test.ts`
- `npm run test:db -- tests/db/fresh-db.publish-smoke.test.ts`
- `npm run ci:local`

## Acceptance criteria
- active code path に in-memory `drafts.ts` / `publish.ts` 依存の publish flow が残っていない
- workspace draft から publish できる
- fresh DB publish smoke が green
- docs に canonical publish flow が明記されている

## Deliverables
- publish path 整理
- deprecated path の削除または quarantine
- publish integration tests
- docs 更新

## Dependencies / Next-ticket prerequisites
- **T7 green**
- **T9 は T8 が green になるまで開始しない**

## Stop conditions / Blockers
- workspace と in-memory publish が並立したまま
- canonical path が docs と code で一致しない
- publish が fresh DB で通らない
- compatibility 方針が未定義

---

# T9. 最終 eval と rollout 判定を閉じる

**Status**
- [ ] Not started
- [ ] In progress
- [ ] Blocked
- [ ] Green

## Goal
local gate を全部回し、legacy/new emotion path の切替と rollout default を最終決定する。

## Non-goals
- 新アーキテクチャの追加
- 大規模 prompt 再設計
- model/provider 再選定
- 新しい feature の追加

## Invariants
- hidden blocker を「今後対応」に逃がさない
- final report は pass/fail で書く
- legacy path を残すなら feature flag 管理する
- 完了判定はテストと gate の結果に基づく

## Required tests
### 実行するコマンド
- `npm run test`
- `npm run test:db`
- `npm run test:workflow`
- `npm run eval:smoke`
- `npm run ci:local`

### 検証内容
- full regression harness
- full DB smoke
- full workflow smoke/integration
- final prod/draft parity
- rollout flag behavior

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
- engineering note / release note

## Dependencies / Next-ticket prerequisites
- **T8 green**
- これが最後

## Stop conditions / Blockers
- local gate のいずれか 1 つでも red
- hidden blocker が report に載っていない
- legacy/new path の切替条件が未定義
- final parity が red

---

## 推奨チケット運用テンプレート

各チケットを AI に渡すときは、毎回このテンプレートで始めること。

```text
You are working on exactly one ticket in yumekano-agent.

Rules:
- Read only the files relevant to this ticket.
- Do not widen scope.
- Write failing tests first.
- After each change, run the smallest relevant test set.
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

監査役 AI には次を渡す。

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

## 最後に

このプランの本質は、**広く直すのではなく、契約を固定し、テストで gate を作り、green になったら次へ進む**ことです。  
今度こそ崩さないために、必ず **1 ticket = 1 subsystem** を守ること。
