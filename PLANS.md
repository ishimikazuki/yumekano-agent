# 現在の作業: yumekano-agent 改善実装プラン

## チケット一覧

| ID | タイトル | 状態 |
|----|---------|------|
| T0 | ローカル品質ゲートの新設 | done |
| T1 | generatorIntimacyMd の persistence contract 完全修正 | done |
| T2 | prompt contract の canonical source 一本化 | done |
| T3 | CoE 契約と回帰フィクスチャを先に定義 | done |
| T4 | CoE extractor と pure integrator を作る | done |
| T5 | production chat_turn を新 core に配線 | pending |
| T6 | draft/playground を stateful にし prod/draft parity を作る | pending |
| T7 | generator/ranker の memory path と deterministic gates 完成 | pending |
| T8 | publish/versioning を DB-backed workspace path に統一 | pending |
| T9 | 最終 eval と rollout 判定 | pending |

---

## T0: ローカル品質ゲートの新設

### ゴール
repo に標準のテスト / eval エントリポイントを追加し、以後の修正をすべて同じ品質ゲートで回せる状態にする。

### 受入基準
- [x] `package.json` に test, test:unit, test:db, test:workflow, eval:smoke, ci:local scripts が存在する
- [x] テストランナーと設定ファイルがコミットされている
- [x] `npm run test:db` で fresh DB migrate/seed smoke が実行される
- [x] `npm run test:workflow` で mocked workflow smoke が最低 1 本通る
- [x] 本 ticket の diff が emotion / planner / generator / ranker / workflow の本番ロジックを変更していない

### 必要テスト
- `tests/db/fresh-db.migrate-smoke.test.ts` が存在し pass
- `tests/db/fresh-db.seed-smoke.test.ts` が存在し pass
- `tests/workflow/chat-turn.smoke.test.ts` が存在し pass
- `npm run test:db` が green
- `npm run test:workflow` が green
- `npm run ci:local` が green

---

## T1: generatorIntimacyMd の persistence contract 完全修正

### ゴール
`workspace_draft_state` と `prompt_bundle_versions` を、schema / migration / repository / seed の全層で `generatorIntimacyMd` に一致させる。

### 受入基準
- [x] `workspace_draft_state` に `generator_intimacy_md` 列が存在する
- [x] `prompt_bundle_versions` に `generator_intimacy_md` 列が存在する
- [x] schema / migration / repository / seed がその列名と意味で一致している
- [x] fresh DB smoke が green
- [x] `generatorIntimacyMd` が prod / draft の両方で authored value として取得できる

### 必要テスト
- `tests/contracts/prompt-bundle.generator-intimacy.contract.test.ts` が存在し pass
- `tests/contracts/workspace-draft.generator-intimacy.contract.test.ts` が存在し pass
- `tests/db/fresh-db.workspace-prompt-contract.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T2: prompt contract の canonical source 一本化

### ゴール
runtime schema を唯一の canonical contract にし、checked-in prompts / seed prompts / override semantics をそれに揃える。

### 受入基準
- [x] checked-in prompt examples に旧 field 名が active example として残っていない
- [x] seed prompt 群が runtime schema と一致する
- [x] planner / generator / ranker の prompt family ごとに drift 防止 contract test がある
- [x] `promptOverride` の意味論がコードとテストで固定されている
- [x] canonical contract が runtime schema であることが docs / tests / code で一致している

### 必要テスト
- `tests/contracts/planner-prompt.contract.test.ts` が存在し pass
- `tests/contracts/generator-prompt.contract.test.ts` が存在し pass
- `tests/contracts/ranker-prompt.contract.test.ts` が存在し pass
- `tests/contracts/seed-prompt.contract.test.ts` が存在し pass
- `tests/contracts/prompt-override.behavior.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T3: CoE 契約と回帰フィクスチャを先に定義

### ゴール
CoE 主導 emotion system の型契約と fixture corpus を先に作る。本番配線の前に、何を正解とみなすかを test で固定する。

### 受入基準
- [x] `CoEEvidence`, `RelationalAppraisal`, `EmotionUpdateProposal`, `PairMetricDelta`, `EmotionTrace` の schema/type が存在する
- [x] required fixture (11種) がすべてコミットされている
- [x] 各 fixture が evidence / axes / PAD delta / pair metric delta を検証している
- [x] テストが deterministic で live model を要求しない

### 必要テスト
- `tests/contracts/coe-schemas.contract.test.ts` が存在し pass
- `tests/evals/emotion/compliment.fixture.test.ts` が存在し pass
- `tests/evals/emotion/mild-rejection.fixture.test.ts` が存在し pass
- `tests/evals/emotion/explicit-insult.fixture.test.ts` が存在し pass
- `tests/evals/emotion/apology.fixture.test.ts` が存在し pass
- `tests/evals/emotion/repair.fixture.test.ts` が存在し pass
- `tests/evals/emotion/repeated-pressure.fixture.test.ts` が存在し pass
- `tests/evals/emotion/intimacy-positive-context.fixture.test.ts` が存在し pass
- `tests/evals/emotion/intimacy-boundary-crossing.fixture.test.ts` が存在し pass
- `tests/evals/emotion/topic-shift-after-tension.fixture.test.ts` が存在し pass
- `tests/evals/emotion/two-turn-carry-over.fixture.test.ts` が存在し pass
- `tests/evals/emotion/five-turn-progression.fixture.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T4: CoE extractor と pure integrator を作る

### ゴール
`user text -> CoE evidence -> relational appraisal -> PAD / pair delta` の pure core を実装する。

### 受入基準
- [x] dedicated CoE extractor module がある
- [x] dedicated relational integrator module がある
- [x] new path は regex message matching を main path に使わない
- [x] malformed model output handling が code と test で定義されている
- [x] required unit tests が green

### 必要テスト
- `tests/unit/coe-extractor.mocked.test.ts` が存在し pass
- `tests/unit/coe-extractor.parse-repair.test.ts` が存在し pass
- `tests/unit/relational-integrator.insult-shock.test.ts` が存在し pass
- `tests/unit/relational-integrator.apology-repair.test.ts` が存在し pass
- `tests/unit/relational-integrator.sustained-pressure.test.ts` が存在し pass
- `tests/unit/relational-integrator.affectionate-carry-over.test.ts` が存在し pass
- `tests/unit/relational-integrator.quiet-turn-decay.test.ts` が存在し pass
- `tests/unit/relational-integrator.open-thread-bias.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T5: production chat_turn を新 core に配線

### ゴール
production `runChatTurn` を new CoE path に切り替え、pair metrics / phase inputs / trace を設計どおりに近づける。

### 受入基準
- [ ] production `chat_turn` の本線が new CoE path を使う
- [ ] `turnsSinceLastUpdate: 1` の固定がなくなる
- [ ] `events: new Map()`, `topics: new Map()`, zero counter placeholder が導出可能な実値に置き換わる
- [ ] pair metrics が DB に保存される
- [ ] trace に新しい state reasoning が残る
- [ ] required workflow integration tests が green

### 必要テスト
- `tests/workflow/prod-chat-turn.one-turn.integration.test.ts` が存在し pass
- `tests/workflow/prod-chat-turn.three-turn.integration.test.ts` が存在し pass
- `tests/workflow/prod-chat-turn.phase-transition.integration.test.ts` が存在し pass
- `tests/workflow/prod-chat-turn.pair-state-persistence.integration.test.ts` が存在し pass
- `tests/workflow/prod-chat-turn.trace.integration.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T6: draft/playground を stateful にし prod/draft parity を作る

### ゴール
sandbox tables を本当に使い、draft/playground を continuing-session ベースの stateful workflow にする。prod と同じ core を使い、prod/draft parity をテストで固定する。

### 受入基準
- [ ] draft/playground が PAD を session across turns で持ち越す
- [ ] draft/playground が pair metrics を持ち越す
- [ ] draft/playground が sandbox working memory を持ち越す
- [ ] draft の `phaseIdAfter` が固定ではない
- [ ] parity test が green

### 必要テスト
- `tests/workflow/draft-chat-turn.sandbox-pair-state.integration.test.ts` が存在し pass
- `tests/workflow/draft-chat-turn.sandbox-working-memory.integration.test.ts` が存在し pass
- `tests/workflow/draft-chat-turn.multi-turn.integration.test.ts` が存在し pass
- `tests/workflow/draft-chat-turn.explicit-reset.integration.test.ts` が存在し pass
- `tests/workflow/prod-draft.parity.integration.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T7: generator/ranker の memory path と deterministic gates 完成

### ゴール
generator と ranker に retrieved memory を正しく通し、LLM ranker の前に deterministic reject を置く。

### 受入基準
- [ ] generator prompt/context が retrieved memory を使う
- [ ] ranker input が memoryGrounding に必要な context を持つ
- [ ] deterministic gates が code path として存在する
- [ ] reject された候補は model judgement 前に落ちる
- [ ] required tests が green

### 必要テスト
- `tests/contracts/generator-memory-context.contract.test.ts` が存在し pass
- `tests/contracts/ranker-memory-context.contract.test.ts` が存在し pass
- `tests/unit/ranker-gates.phase-violation.test.ts` が存在し pass
- `tests/unit/ranker-gates.intimacy-violation.test.ts` が存在し pass
- `tests/unit/ranker-gates.memory-contradiction.test.ts` が存在し pass
- `tests/unit/ranker-gates.coe-contradiction.test.ts` が存在し pass
- `tests/unit/ranker-gates.hard-safety.test.ts` が存在し pass
- `tests/workflow/ranker.integration.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T8: publish/versioning を DB-backed workspace path に統一

### ゴール
workspace draft を唯一の canonical authoring source にし、in-memory draft/publish path を整理する。

### 受入基準
- [ ] active code path に in-memory drafts.ts / publish.ts 依存の publish flow が残っていない
- [ ] workspace draft から publish できる
- [ ] fresh DB publish smoke が green
- [ ] docs に canonical publish flow が明記されている

### 必要テスト
- `tests/workflow/publish.from-workspace.integration.test.ts` が存在し pass
- `tests/workflow/versioning.create-version.integration.test.ts` が存在し pass
- `tests/workflow/release.activate.integration.test.ts` が存在し pass
- `tests/db/fresh-db.publish-smoke.test.ts` が存在し pass
- `npm run ci:local` が green

---

## T9: 最終 eval と rollout 判定

### ゴール
local gate を全部回し、legacy/new emotion path の切替と rollout default を最終決定する。

### 受入基準
- [ ] `npm run test`, `npm run test:db`, `npm run test:workflow`, `npm run eval:smoke`, `npm run ci:local` がすべて green
- [ ] final markdown report が生成される
- [ ] legacy/new emotion path の default flag が決まっている
- [ ] remaining blockers がある場合は report に明示されている
- [ ] "complete / not complete" を pass/fail で宣言できる

### 必要テスト
- `npm run test` が green
- `npm run test:db` が green
- `npm run test:workflow` が green
- `npm run eval:smoke` が green
- `npm run ci:local` が green

---

## 発見・予想外のこと

- 2026-04-03: PLAN.md指定のテストファイルが1つも存在しない。機能実装は進んでいるが別ファイル名でテストされている
- 2026-04-03: PLANS.md (旧バグ修正チケット T0-T3) は全完了済み

## 決定したこと

- 2026-04-03: PLAN.mdのチケット体系で正式にチケットループを回す
- 2026-04-03: 既存テストを活かしつつ、PLAN.md指定のファイル名でテストを整備する
