# yumekano-agent 完全修正計画

## Status

This file is the strategic master plan.
Operational execution must use `plans/tickets/T*.md` together with this file.
If there is any conflict, preserve the intent and execution order of this master plan, and use the current ticket file for task-local acceptance criteria and boundaries.

## 0. この計画の前提

この計画は、**CoE を中心にした感情更新と関係状態更新を、解釈ずれの少ない契約とテストで固定しながら、段階的に本番へ置き換える**ための実行計画である。

この計画では、次の語を厳密な意味で使う。

- **MUST**: 必須。満たしていない変更は採用しない。
- **MUST NOT**: 禁止。違反した変更は採用しない。
- **SHOULD**: 強い推奨。例外がある場合は理由を記録する。
- **MAY**: 任意。必要な場合のみ行う。

この計画における「完璧」とは、**明文化された仕様・テスト・CI・移行条件・ロールバック条件がそろい、全ての受け入れ条件を満たした状態**を指す。曖昧な「なんとなく良くなった」は完了とみなさない。

---

## 1. 目的

### 1.1 主目的

1. `src/lib/rules/appraisal.ts` の**パターンマッチ中心の appraisal**を、**CoE 主導の構造化 appraisal**に置き換える。
2. PAD 更新を、**意味理解と状態積分を分離した設計**に置き換える。
3. `src/mastra/workflows/chat-turn.ts` と `src/mastra/workflows/draft-chat-turn.ts` の**状態進行の差分**をなくす。
4. prompt の source-of-truth を一本化する。
5. publish / versioning / workspace / migrations / tests を整合させる。
6. 「一発プロンプトでまとめて直す」方式をやめ、**契約駆動・テスト駆動・段階移行**に切り替える。

### 1.2 今回の修正対象

- CoE / appraisal / PAD / pair state
- production workflow
- sandbox / draft workflow
- prompt persistence / loading / editing
- publish / versioning / migrations
- ranker の deterministic gate
- eval / test harness / CI gate

### 1.3 今回の修正対象外

次は**最終段階まで後回し**にする。

- 文体の微調整
- キャラ性の fine tuning
- モデル比較の最適化
- プロンプトの感性調整

理由は、**内部状態が壊れたまま文体やモデルをいじっても、表面だけ良く見えて根本の不整合が残る**ためである。

---

## 2. なぜ前回まで完璧に直らなかったのか

前回までの修正が不完全だった理由は、モデルの性能不足が主因ではない。主因は**変更の進め方と受け入れ条件の弱さ**である。

### 2.1 一回の指示で複数サブシステムを同時に直そうとした

CoE、PAD、prompt、sandbox、versioning、migrations、ranker を同時に触ると、AI 実装者は**どこを source-of-truth にすべきか**を見失いやすい。

### 2.2 仕様より先に実装を触った

「どう直すか」より先に「何が正しい状態か」を固定していないため、AI は既存コードの局所的整合だけを取ってしまった。

### 2.3 failing tests が先に無かった

実装前に壊れていることを示すテストが無いと、AI は「それらしく変更したが、本当に要件を満たしたか不明」なまま終了しやすい。

### 2.4 production と draft の runtime path が別物だった

本番経路と sandbox 経路が違うのに、片方だけ直して「直った」と解釈しやすかった。

### 2.5 prompt の source-of-truth が分裂していた

checked-in prompt、seed prompt、DB persisted prompt、draft prompt が並立していると、どれを直せば runtime に効くのかが曖昧になる。

### 2.6 migration / persistence / publish の確認が後回しだった

schema を直しても、DB の列、repo、publish path、draft storage が揃っていないと実際には動かない。

### 2.7 「解釈を止める条件」が無かった

AI に対して「曖昧なら止まれ」が無いと、推測で埋めてしまう。これが partial fix を生む。

### 2.8 human review が diff review ではなく結果レビュー寄りだった

出力文だけ見て「良さそう」と判断すると、内部状態、永続化、feature flag、rollback path の欠陥を見落としやすい。

---

## 3. 今回採用する方法

今回は、**ワンショット実装**ではなく、**仕様固定 → 失敗テスト作成 → 小分け実装 → shadow 比較 → 本番置換**の順序で進める。

### 3.1 採用する実装方式

この計画では次の方式を採用する。

1. **Spec-first**
   - 先に仕様と契約を定義する。
2. **Test-first**
   - 先に failing tests を作る。
3. **One-ticket-one-subsystem**
   - 1 チケットで 1 サブシステムだけを変更する。
4. **Feature-flag migration**
   - 旧経路と新経路を比較できる状態で進める。
5. **Two-model protocol**
   - 実装担当 AI と監査担当 AI を分ける。
6. **CI-gated merge**
   - テスト、型、lint、eval が通らない変更は採用しない。

### 3.2 今回の本命アーキテクチャ

修正後の中核フローは次である。

1. **CoE Evidence Extractor**
   - LLM が入力文脈から「何が起きたか」を構造化する。
2. **Relational Appraisal Layer**
   - 構造化 evidence を関係意味の軸に写像する。
3. **Deterministic Integrator**
   - appraisal 軸を PAD と pair metrics に積分する。
4. **Planner / Generator / Ranker Context Injection**
   - 上記の evidence と state delta を downstream に渡す。
5. **Persistence / Trace**
   - trace と永続 state に同じ情報を保存する。

### 3.3 重要な分離原則

- **意味理解**は CoE が担う。
- **状態更新量の決定**は integrator が担う。
- **安全制御と同意制御**は deterministic guardrails が担う。
- **文体**は最後に調整する。

この分離を壊してはならない。

---

## 4. 完了条件

次を全て満たしたときのみ「完了」とする。

1. heuristic appraisal が main path から外れている。
2. CoE evidence schema と appraisal schema が型・Zod・テストで固定されている。
3. PAD 更新が regex 依存ではなく integrator 依存になっている。
4. trust / affinity / conflict / intimacyReadiness が production path で更新される。
5. draft / sandbox が自分自身の session state を持ち越す。
6. production と draft が同じ CoE → integrator path を使う。
7. prompt source-of-truth が 1 系統に統一されている。
8. prompt persistence と migration が round-trip test に通る。
9. publish / versioning / workspace が単一路線で説明できる。
10. ranker に deterministic pre-gates がある。
11. eval suite が追加され、既知ケースに対して pass/fail が見える。
12. feature flag で旧経路と新経路を比較できる。
13. 旧経路削除前に shadow run の比較レポートがある。
14. CI で unit / integration / migration / eval が全て green になる。

---

## 5. 今回の実行プロトコル

### 5.1 変更単位

- 1 チケット = 1 サブシステム
- 1 PR = 1 チケット
- 1 PR に複数の設計変更を混ぜない

### 5.2 AI 実装者への共通ルール

以下は全チケット共通の MUST である。

1. 変更前に以下を読む。
   - `AGENTS.md`
   - `PRD.md`
   - `APP_OVERVIEW.md`
   - `ARCHITECTURE.md`
   - `DATA_MODEL.md`
   - `WORKFLOWS.md`
   - `EVALS.md`
   - 当該チケットに関係するファイルだけ
2. 先に failing tests を作る。
3. 変更範囲を広げない。
4. 曖昧さがあれば止まり、推測で実装しない。
5. feature flag が必要な変更は、比較可能な形で入れる。
6. 変更後に最小テスト集合を必ず実行する。
7. 最後に以下を必ず報告する。
   - 変更ファイル
   - 追加テスト
   - 実行コマンド
   - 結果
   - 残リスク

### 5.3 AI 監査者への共通ルール

実装担当とは別の AI か、人間レビューで次を確認する。

1. チケットのスコープ外変更が無いか
2. failing tests が先に作られているか
3. acceptance criteria を全て満たしているか
4. feature flag / rollback path があるか
5. migration と persistence が壊れていないか
6. 本番と sandbox の差分が増えていないか

### 5.4 Merge gate

全 PR は以下を満たさなければ merge しない。

- lint green
- typecheck green
- relevant unit tests green
- relevant integration tests green
- migration tests green
- relevant eval green
- reviewer checklist green

---

## 6. Codex / Claude Code に渡す共通プロンプト

以下を毎回のチケットの先頭に付ける。

```text
You are modifying the yumekano-agent repository.

Read first:
- AGENTS.md
- PRD.md
- APP_OVERVIEW.md
- ARCHITECTURE.md
- DATA_MODEL.md
- WORKFLOWS.md
- EVALS.md
- Only the files relevant to this ticket

Global rules:
- Change only one subsystem in this ticket
- Write failing tests first
- Run the smallest relevant test set after the change
- Do not widen scope silently
- If anything is ambiguous, stop and report instead of guessing
- If the migration is risky, keep old behavior behind a feature flag
- At the end, report:
  1. files changed
  2. tests added or updated
  3. commands run
  4. result
  5. remaining risks
```

---

## 7. 修正チケット一覧

以下の順番を変えてはならない。前のチケットが green になる前に次へ進んではならない。

---

## T0. ベースライン固定とテスト基盤の整備

### 目的

後続の変更が「何を壊したか」をすぐ検出できる状態を作る。

### 対象

- `package.json`
- `tests/`
- `evals/`
- 必要なら `vitest.config.*` または相当する test config
- CI 設定ファイル

### MUST

1. 標準コマンドを定義する。
   - `npm run test:unit`
   - `npm run test:integration`
   - `npm run test:migrations`
   - `npm run eval:emotion`
   - `npm run eval:full`
2. 次の評価ケースを fixture 化する。
   - compliment
   - mild rejection
   - explicit insult
   - apology / repair
   - repeated pressure
   - positive intimacy escalation
   - boundary-crossing intimacy escalation
   - topic shift after tension
   - two-turn carry-over
   - five-turn progression
3. 各 fixture で少なくとも次を評価できるようにする。
   - PAD delta band
   - pair metrics delta band
   - CoE reason fields
4. 現時点の失敗状態をレポートに残す。

### MUST NOT

- runtime behavior を本格変更しない
- appraisal ロジックを書き換えない

### 受け入れ条件

- テストコマンドがローカルで実行できる
- 最低 10 ケースの fixture がある
- 現状では失敗していることが見える
- レポートが `tests/` か `evals/` 配下に残る

### Codex / Claude へ渡すタスク本文

```text
Task ID: T0
Goal: Freeze the current behavior and add a regression harness before any runtime refactor.

Requirements:
- Add standardized test and eval commands if they do not exist yet
- Add fixtures for 10 emotion/relationship cases
- Each fixture must assert PAD delta band, pair metric delta band, and CoE reason fields
- Do not change production behavior except for exposing test seams
- Produce a markdown report of current failures
```

---

## T1. CoE と appraisal の契約定義

### 目的

「CoE が何を返し、integrator が何を受け取るか」を型で固定する。

### 対象

- `src/lib/schemas/*`
- 必要なら `src/lib/types/*`
- 既存 adapter 層

### 新規に定義する契約

#### CoEEvidence

最低限、次を持つ。

- `acts`: 相互作用行為の配列
- `target`: `assistant | user | relationship | topic | third_party`
- `polarity`: `-1..1`
- `intensity`: `0..1`
- `evidenceSpans`: 文字列配列
- `confidence`: `0..1`
- `uncertaintyNotes`: 文字列配列

#### RelationalAppraisal

最低限、次を持つ。

- `warmthImpact`
- `rejectionImpact`
- `respectImpact`
- `threatImpact`
- `pressureImpact`
- `repairImpact`
- `reciprocityImpact`
- `intimacySignal`
- `boundarySignal`
- `certainty`

各数値範囲は明文化する。

#### EmotionStateDelta

最低限、次を持つ。

- `padDelta`
- `pairMetricDelta`
- `reasonRefs`
- `guardrailOverrides`

### MUST

1. Zod schema と TypeScript type を両方用意する。
2. invalid / partial / malformed model output の parser tests を追加する。
3. 旧 heuristic appraisal は adapter 経由で生かす。
4. production path にはまだ差し込まない。

### 受け入れ条件

- 契約が schema / type / parser test で固定されている
- malformed output を安全に弾ける
- 旧 path を壊していない

### Codex / Claude へ渡すタスク本文

```text
Task ID: T1
Goal: Add the CoE-driven emotion contracts without changing runtime behavior.

Requirements:
- Add zod schemas and TypeScript types for CoEEvidence, RelationalAppraisal, EmotionStateDelta, and related trace objects
- Keep the old heuristic appraisal path behind an adapter
- Add parser tests for invalid and partial model outputs
- Do not wire the new path into production yet
```

---

## T2. CoE Evidence Extractor の実装

### 目的

意味理解を regex から分離し、構造化 evidence と relational axes を返す経路を作る。

### 対象

- `src/mastra/agents/` に新規 agent を追加
- 必要なら `src/lib/prompts/` または canonical prompt storage
- `tests/fixtures/`

### MUST

1. 入力には次を含める。
   - user message
   - recent dialogue
   - current phase
   - pair state
   - working memory
   - retrieved facts / events / threads / observations
   - open threads
2. 出力には次を含める。
   - interaction acts
   - relational appraisal axes
   - evidence spans
   - confidence
   - uncertainty notes
3. malformed output の retry / validation を入れる。
4. CI で live model call を必須にしない。mock か fixture で通す。
5. 旧 heuristic path はまだ消さない。

### MUST NOT

- PAD 更新ロジックをここに持ち込まない
- pair state 更新量をここで直接決めない

### 受け入れ条件

- insult / apology / pressure / boundary-crossing の 4 ケースで構造化 output がテストできる
- parser failure 時に safe fallback がある
- live call なしでも unit tests が通る

### Codex / Claude へ渡すタスク本文

```text
Task ID: T2
Goal: Implement a model-driven CoE Evidence Extractor as the main semantic interpretation path.

Requirements:
- Add a dedicated CoE or emotion analysis agent module
- Input must include user message, recent dialogue, phase, pair state, working memory, retrieved memory, and open threads
- Output must include interaction acts, relational appraisal axes, evidence spans, confidence, and uncertainty notes
- Add validation and retry behavior for malformed outputs
- Add mocked tests so CI does not require live model calls
- Do not remove the old heuristic path yet
```

---

## T3. Deterministic Integrator の実装

### 目的

CoE appraisal を PAD と pair metrics に安定して積分する。

### 対象

- `src/lib/rules/pad.ts`
- 新規 `integrator.ts` など
- character emotion spec / config 参照箇所

### MUST

1. integrator は regex に依存しない。
2. 変化量は次を考慮する。
   - instantaneous effect
   - slow mood carry-over
   - decay
   - inertia
   - clamp
   - open-thread bias
   - phase modifier
3. 更新対象は少なくとも次を含む。
   - PAD
   - trust
   - affinity
   - conflict
   - intimacyReadiness
4. abusive / consent / safety only は deterministic guardrail として残す。
5. 重みは workflow にハードコードせず config / spec から読む。
6. 旧 path との比較のため feature flag を付ける。

### 例示的な受け入れ帯域

以下は初期 neutral 近傍からの目安帯域である。最終値ではなく delta の帯域としてテストする。

| ケース | P | A | D | trust | affinity | conflict | intimacyReadiness |
|---|---:|---:|---:|---:|---:|---:|---:|
| compliment | +0.10 以上 | +0.03 以上 | +0.05 以上 | +4 以上 | +6 以上 | 0 以下 | 0 以上 |
| explicit insult | -0.20 以下 | +0.15 以上 | -0.15 以下 | -10 以下 | -8 以下 | +12 以上 | 0 以下 |
| apology after hurt | +0.10 以上 | -0.05 以下 | +0.05 以上 | +8 以上 | +4 以上 | -5 以下 | 0 以上 |
| repeated pressure | 各 turn で悪化 | 各 turn で上昇または高止まり | 各 turn で低下 | 低下 | 低下 | 上昇 | 低下 |

### 受け入れ条件

- insult shock が十分大きく動く
- apology repair が conflict を下げる
- quiet turn で baseline へ滑らかに戻る
- sustained pressure が複数ターンで累積する
- open thread が bias として効く

### Codex / Claude へ渡すタスク本文

```text
Task ID: T3
Goal: Implement a deterministic PAD and pair-state integrator driven by CoE appraisal.

Requirements:
- The integrator must not depend on regex pattern matching
- Map CoE relational axes to PAD delta and pair metric deltas
- Include decay, inertia, clamps, open-thread bias, and phase modifiers
- Keep a small deterministic abuse/consent guardrail layer only as override logic
- Read weights from config or character emotion spec
- Put the new path behind a feature flag so old and new behavior can be compared
```

---

## T4. production `chat-turn` への配線

### 目的

production path を新しい CoE → integrator 経路へ差し替える。

### 対象

- `src/mastra/workflows/chat-turn.ts`
- planner / generator / ranker への context injection
- trace persistence

### MUST

1. heuristic appraisal の直接呼び出しを main path から外す。
2. 更新された pair metrics を永続化する。
3. CoE evidence / appraisal / state delta を trace に保存する。
4. planner / generator / ranker に次を渡す。
   - evidence
   - relational appraisal
   - current state
   - state delta
   - observations を含む retrieved memory
5. feature flag 有効時は old/new comparison を trace に残す。

### MUST NOT

- prompt source-of-truth の全面整理をここで同時にやらない

### 受け入れ条件

- one-turn integration test が通る
- three-turn progression test が通る
- trust / affinity / conflict / intimacyReadiness の保存が確認できる
- trace から old/new 差分が見える

### Codex / Claude へ渡すタスク本文

```text
Task ID: T4
Goal: Wire the new CoE -> integrator pipeline into production chat_turn.

Requirements:
- Replace the direct heuristic appraisal call in production with the new pipeline
- Persist updated pair metrics, not only PAD
- Pass CoE evidence and observations into downstream planner, generator, and ranker context
- Extend trace data with evidence, relational appraisal, and state deltas
- When the feature flag is enabled, include old/new comparison in the trace
```

---

## T5. draft / sandbox の stateful 化と production 整合

### 目的

sandbox を「会話文脈だけ継続して内部状態は毎回ほぼ初期化」という状態から脱却させる。

### 対象

- `src/mastra/workflows/draft-chat-turn.ts`
- workspace repo
- sandbox state persistence
- migrations if required

### MUST

1. sandbox session は少なくとも次を持ち越す。
   - PAD
   - trust
   - affinity
   - conflict
   - intimacyReadiness
   - open threads
   - current phase
   - relevant working memory summary
2. reset は**明示操作**でのみ起きる。
3. production と同じ CoE → integrator path を使う。
4. production data と sandbox data は分離するが、sandbox 自身の session state は維持する。
5. multi-turn carry-over tests を入れる。

### 受け入れ条件

- two-turn carry-over test が通る
- five-turn progression test が通る
- draft path の phase / PAD / pair state が session を跨いで継続する
- explicit reset test が通る

### Codex / Claude へ渡すタスク本文

```text
Task ID: T5
Goal: Make draft and sandbox chat stateful and behaviorally aligned with production.

Requirements:
- Carry forward PAD, pair metrics, open threads, phase, and relevant memory-derived state within a sandbox session
- Reset only when explicitly requested
- Reuse the same CoE and integrator path as production
- Keep sandbox isolation from production data, but not from its own session state
- Add multi-turn tests proving state carry-over
```

---

## T6. prompt source-of-truth の一本化

### 目的

prompt の保存・読込・編集・seed・runtime の形を 1 つにする。

### 対象

- `src/lib/schemas/prompts.ts`
- prompt repository
- workspace repo
- seed/default prompt definitions
- runtime loading path
- draft editing path

### MUST

1. canonical prompt bundle shape を 1 つ決める。
2. planner / generator / generatorIntimacy / ranker / CoE appraiser をその shape に含める。
3. checked-in default prompts、DB persisted prompts、draft prompts、runtime loading を同じ shape に揃える。
4. divergence のある inline prompts は削除するか deprecated と明示する。
5. round-trip tests を追加する。
6. migration を必要な分だけ追加する。

### 受け入れ条件

- prompt bundle が保存して読み戻せる
- generatorIntimacy と CoE appraiser prompt が確実に永続化される
- runtime が canonical bundle だけを使う
- 旧データ用 compatibility path がある

### Codex / Claude へ渡すタスク本文

```text
Task ID: T6
Goal: Consolidate the prompt source-of-truth into one canonical prompt bundle.

Requirements:
- Define one canonical prompt bundle shape used by schemas, storage, seed/default prompts, runtime loading, and draft editing
- Include planner, generator, generatorIntimacy, ranker, and CoE appraiser prompts
- Remove or explicitly deprecate divergent inline prompt definitions
- Add round-trip tests for prompt persistence
- Add migrations or compatibility layers if existing data would break
```

---

## T7. publish / versioning / workspace / migrations の統合

### 目的

workspace から publish までを、1 本の説明可能な経路に統一する。

### 対象

- `src/lib/versioning/*`
- workspace repo
- prompt bundle repo
- phase graph repo
- migrations
- release / publish path

### MUST

1. publish までの canonical flow を 1 つに定義する。
2. workspace draft model と publish model のズレをなくす。
3. migration が schema と repo 実装に一致することを migration tests で保証する。
4. in-memory legacy path が残るなら deprecated と明示する。
5. publish integration test を追加する。

### 受け入れ条件

- workspace draft から publish まで通る
- prompt bundle / phase graph version が正しく保存される
- fresh DB でも migration 後に正常動作する
- compatibility path の有無が明記されている

### Codex / Claude へ渡すタスク本文

```text
Task ID: T7
Goal: Unify workspace, versioning, publish, and migrations into one canonical path.

Requirements:
- Define one canonical publish flow from workspace draft to release
- Remove or explicitly deprecate divergent legacy in-memory paths
- Ensure migrations, repositories, and schemas are consistent
- Add migration tests and publish integration tests
```

---

## T8. ranker の deterministic gate と final eval

### 目的

候補選択が感情状態・安全・phase・memory と矛盾しないようにする。

### 対象

- `src/mastra/agents/ranker.ts`
- `src/mastra/scorers/*`
- eval suite

### MUST

1. model-based ranker の前に deterministic gates を入れる。
2. 最低限の gate は次を含む。
   - hard safety violation
   - phase violation
   - contradiction with current CoE state
   - memory contradiction
3. tie-break と score explanation を trace に残す。
4. 最後に full eval を実行し、レポートを生成する。
5. このチケットでは architecture ではなく weights / config / thresholds だけを調整する。

### 受け入れ条件

- unsafe candidate が pre-ranker で落ちる
- phase contradiction が落ちる
- memory contradiction が落ちる
- eval report が出る
- rollout recommendation が文書化される

### Codex / Claude へ渡すタスク本文

```text
Task ID: T8
Goal: Finish the migration by adding deterministic ranker gates and running the full eval suite.

Requirements:
- Add deterministic pre-ranker gates for safety, phase violations, CoE-state contradictions, and memory contradictions
- Then run the model-based ranker
- Run the full emotion and relationship eval suite
- Tune only configuration and weights in this ticket, not the architecture
- Produce a final markdown report with pass/fail counts, biggest remaining weak cases, rollout recommendation, and feature-flag recommendation
```

---

## T9. 旧経路の削除

### 目的

新経路が十分に検証された後にのみ、legacy heuristic path を削除する。

### 前提条件

このチケットは、T0 から T8 が全て green で、shadow comparison レポートがある場合のみ着手してよい。

### MUST

1. 削除前に rollback plan を文書化する。
2. feature flag の切り戻し手順を残す。
3. 旧 heuristic path と未使用 adapter を削除する。
4. 関連ドキュメントを更新する。

### 受け入れ条件

- 旧 path が削除されている
- ドキュメントが現実と一致する
- 全テストが green のまま

---

## 8. 追加で採用する「完璧に近づける」アプローチ

Codex か Claude Code へチケットを渡すだけでは、まだ失敗余地がある。そこで、次の追加手法を**必須**にする。

### 8.1 二段階 AI 方式

- **実装担当**: Codex または Claude Code
- **監査担当**: 別モデル、または別セッションの同モデル

同じモデルに「作って、自分で OK を出す」をさせない。

### 8.2 Spec packet 方式

各チケットごとに、repo 内に `plans/tickets/T*.md` のような**固定仕様ファイル**を置く。
AI には「このファイルを唯一の acceptance criteria として扱え」と指示する。

この方法の利点は、プロンプトよりも**差分の無い固定仕様**を基準にできることだ。

### 8.3 Replay trace 方式

既知の失敗ケースを replay input として保存し、毎回それを流す。
出力文だけでなく、state delta と trace を比較する。

### 8.4 Shadow comparison 方式

新経路を feature flag で横に並べ、一定期間は old/new の両方を計算する。
**切り替え前に差分を見てから**有効化する。

### 8.5 Stop-the-line 方式

以下のいずれかが起きたら、そのチケットは即停止する。

- acceptance criteria が曖昧
- migration が不明
- source-of-truth が複数ある
- production と draft のどちらに効くか説明できない
- live call が無いとテストできない

---

## 9. 実行順序の厳密ルール

1. T0 を終えるまで runtime refactor をしてはならない。
2. T1 を終えるまで CoE agent を本番配線してはならない。
3. T2 を終えるまで integrator を production に入れてはならない。
4. T3 を終えるまで old/new 比較を始めてはならない。
5. T4 を終えるまで sandbox を直して「完了」と言ってはならない。
6. T5 を終えるまで sandbox の出力を本番品質の根拠にしてはならない。
7. T6 を終えるまで prompt tuning をしてはならない。
8. T7 を終えるまで publish / versioning 完了とみなしてはならない。
9. T8 を終えるまで rollout をしてはならない。
10. T9 を終えるまで legacy deletion をしてはならない。

---

## 10. 変更管理ルール

### 10.1 ブランチ運用

- `refactor/coe-t0-baseline`
- `refactor/coe-t1-contracts`
- `refactor/coe-t2-extractor`
- `refactor/coe-t3-integrator`
- `refactor/coe-t4-production`
- `refactor/coe-t5-sandbox`
- `refactor/coe-t6-prompts`
- `refactor/coe-t7-versioning`
- `refactor/coe-t8-ranker-eval`
- `refactor/coe-t9-cleanup`

### 10.2 PR テンプレートに必須で書くこと

- 何を直すチケットか
- 何を直していないか
- failing tests を先に作ったか
- どの acceptance criteria を満たしたか
- feature flag 名
- rollback 手順
- 既知の残リスク

---

## 11. まず最初にやるべきこと

最初に着手すべきなのは **T0** である。理由は単純で、今は「何がどれだけ壊れているか」を客観的に再現できる状態が弱いからである。

T0 がないまま T1 以降へ進むと、また同じ失敗を繰り返す。

---

## 12. 最終判断

今回の問題は、単にプロンプトが弱かったのではない。**変更の分解、契約の固定、テストの先行、runtime path の統一、migration の検証、review protocol の分離**が足りなかった。

したがって、今回は「もっと強い一発プロンプト」を目指さない。
代わりに、**実装者 AI が迷えない仕様と、誤魔化せない受け入れ条件**を先に作る。

この計画に従えば、前回までのような「一応直したが、本質は直っていない」という状態をかなり防げる。
