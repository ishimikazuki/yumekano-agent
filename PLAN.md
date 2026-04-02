# PLAN.md

# yumekano-agent 修正・移行計画

## 0. この文書の役割

この文書は、`yumekano-agent` を安全に改善するための **唯一の実行計画** である。  
この文書は、実装者 AI に細かい実装手順を与えるものではない。  
この文書は、**何を直すか、何を壊してはいけないか、何が通れば次に進んでよいか** を固定するためのものとする。

この計画の目的は次の 5 つ。

1. 実装方針は AI に考えさせる
2. ただし成功条件は人間が固定する
3. fresh DB / prod / draft / prompt persistence / eval を同時に守る
4. ticket ごとに完了判定できるようにする
5. Claude Code による **ゲート付き自律遷移** を成立させる

---

## 1. 現状認識

現時点の repo には、少なくとも次の系統の問題がある。

- prompt / schema / seed / DB persistence の source-of-truth が分裂している
- `appraisal` が heuristic ベースで、CoE が main decision path ではなく explainer 寄り
- `chat_turn` と `draft-chat-turn` の state progression が乖離している
- prompt persistence の read/write と migration に不整合がある
- prod と draft で使う prompt / state / memory / phase の経路が一致していない
- test / eval の資産は一部あっても、標準の実行導線が弱い

この計画は、上記を **実行可能テストで縛りながら** 解消する。

---

## 2. この計画の設計原則

### 2.1 実装方法は AI に委ねる
この計画では「どう直すか」は Codex / Claude Code に考えさせる。  
人間は **問題定義・不変条件・required tests・acceptance criteria** を固定する。

### 2.2 1 ticket = 1 subsystem
1 回の変更で複数の大分類を同時に解かない。  
scope widening は原則禁止。

### 2.3 failing tests first
実装前に必ず failing test を置く。  
「直った気がする」は禁止。

### 2.4 fresh DB は必須 gate
migration と repo のズレは静的レビューだけでは見落としやすい。  
DB を触る ticket では **fresh DB migrate + seed + init** を必須とする。

### 2.5 prod と draft は最終的に同じ core を呼ぶ
sandbox だから別ロジック、を許さない。  
差分が許されるのは storage target と isolation のみ。

### 2.6 checked-in prompt は canonical ではない
canonical contract は **runtime schema** と **永続化される prompt bundle** とする。  
checked-in prompt assets は template / seed として扱い、drift は contract test で検知する。

### 2.7 merge 条件は diff の見た目ではなく gate
実装完了の判断は、説明の上手さではなく、**acceptance tests の green** のみ。

### 2.8 自律遷移は許可するが、条件は固定する
Claude Code は次の ticket を自律的に選んでよい。  
ただし、**現在の ticket が gate を満たしたときだけ** 次へ進んでよい。

---

## 3. 以前うまくいかなかった理由

前回までの修正が取りこぼした理由は次の通り。

1. 問題が大きすぎる単位で定義されていた
2. 実装手順を細かく固定しすぎて、AI が全体最適を探す余地が少なかった
3. 逆に、壊してはいけない不変条件は十分に固定されていなかった
4. fresh DB / prompt persistence / prod-draft parity のような見えにくい失敗が gate 化されていなかった
5. 実装と監査を分離していなかった
6. 「次の ticket に進んでよい条件」が機械可読ではなかった

この計画では、**解法は自由、成功条件は厳密** にする。

---

## 4. この計画が前提とするファイル

この計画は、repo ルートに次のファイルが存在することを前提とする。

- `PLAN.md`
- `CLAUDE.md`
- `AGENTS.md`（必要なら）
- `.claude/settings.json`
- `.claude/hooks/check-stop.py`
- `.claude/state/current-ticket.json`

---

## 5. Ticket state file

Claude Code による自律遷移と hook 判定のため、  
**現在の ticket 状態は `.claude/state/current-ticket.json` に保存する。**

この state file は、ticket 実行中ずっと更新される。  
ticket 完了を claim する前に、必ずこのファイルを更新すること。

### 5.1 必須フィールド

```json
{
  "ticket_id": "T0",
  "status": "planned | in_progress | ready_to_stop",
  "ready_to_stop": false,
  "tests": {
    "required": [],
    "passed": [],
    "failed": [],
    "all_passed": false
  },
  "acceptance": {
    "required": [],
    "passed": [],
    "failed": [],
    "all_passed": false
  },
  "review": {
    "pass": false,
    "blocking_issues": []
  },
  "notes": ""
}
```

### 5.2 運用ルール

- `ticket_id` は現在の ticket を表す
- `status` は `planned` / `in_progress` / `ready_to_stop` のいずれか
- `ready_to_stop` は、**required tests / acceptance / review がすべて pass したときのみ** `true`
- `tests.required` はその ticket で必須の test コマンドまたは test 種別を記録する
- `acceptance.required` はその ticket の acceptance criteria を機械可読に列挙する
- `review.pass` は、監査 AI が blocking issue なしと判定したときのみ `true`

---

## 6. Ticket 遷移ルール

Claude Code は次の ticket を自律的に選んでよい。  
ただし、**次の条件をすべて満たしたときだけ** 遷移を許可する。

### 遷移条件

1. 現在の ticket の required tests がすべて pass
2. 現在の ticket の acceptance criteria がすべて pass
3. review が pass
4. `.claude/state/current-ticket.json` の `ready_to_stop` が `true`
5. 次 ticket の prerequisite が満たされている
6. 不確実な点が残る場合は遷移しない

### 遷移禁止条件

次のいずれかがある場合、次の ticket に進んではならない。

- fresh DB test が落ちる
- schema / repository / migration drift が残っている
- prod/draft parity が ticket 要件なのに未確認
- checked-in prompt / seed / runtime contract drift が残っている
- required tests が未実装
- review に blocking issue がある
- `ready_to_stop` が false

---

## 7. hook 前提の停止ルール

Claude Code は、作業停止または ticket 完了を claim する前に、  
`.claude/state/current-ticket.json` を更新しなければならない。

`Stop` / `SubagentStop` hook は、次の条件で停止を block する。

- state file が存在しない
- state file が invalid JSON
- 必須フィールドが不足
- `ready_to_stop` が false
- `tests.all_passed` が false
- `acceptance.all_passed` が false
- `review.pass` が false

したがって、**ticket 完了 = state file が完了状態であること** を意味する。

---

## 8. 実行方式

各 ticket は次の流れで進める。

1. `PLAN.md` の ticket 本文をそのまま実装 AI に渡す
2. 実装 AI は failing tests first で作業する
3. 実装 AI は `.claude/state/current-ticket.json` を作成または更新する
4. 実装 AI は最小の関連テストを回す
5. 監査 AI に diff と実装要約を渡す
6. 監査 AI が acceptance criteria を満たしているかだけを判定する
7. green でなければ同じ ticket をやり直す
8. green になったら `ready_to_stop: true` に更新する
9. その後に限って次の ticket を選んでよい

---

## 9. 共通ルール（全 ticket 共通）

このブロックは、各 ticket に共通で実装 AI へ渡す。

```text
You are working on exactly one ticket in yumekano-agent.

Global rules:
- Read PLAN.md and CLAUDE.md first.
- Work on only one ticket at a time.
- Do not widen scope.
- Write failing tests first.
- After each change, run the smallest relevant test set.
- If schema, repository, migration, seed, prompt bundle, or workflow can drift, add a contract test.
- If DB schema is changed, verify fresh DB behavior.
- If draft/prod parity matters, add or run parity tests.
- Update `.claude/state/current-ticket.json` before claiming completion.
- Do not mark `ready_to_stop` true unless:
  - required tests passed
  - acceptance criteria passed
  - review passed
- Do not remove legacy behavior unless the ticket explicitly says so.
- At the end, report:
  1. files changed
  2. tests added
  3. commands run
  4. acceptance criteria pass/fail
  5. remaining risks
```

---

## 10. 共通監査ルール

各 ticket の後に、監査 AI へ渡す。

```text
You are auditing a patch for yumekano-agent.
Do not edit code.

Check only:
- ticket acceptance criteria
- schema/repository/migration consistency
- prod/draft parity impact
- source-of-truth drift
- missing tests
- hidden regression risk

Output:
- pass/fail for each acceptance criterion
- blocking issues only
- missing coverage only if it blocks ticket completion
```

---

# Ticket 一覧

## T0: test / eval / DB smoke の実行導線を作る

### Goal
repo に標準のローカル品質ゲートを作る。  
以後の ticket はこの基盤の上で進める。

### Non-goals
- emotion logic の変更
- planner/generator/ranker の意味変更
- workflow の振る舞い変更

### Invariants
- runtime behavior を変えない
- fresh DB で migrate + seed できる
- 最低限の smoke gate がある

### Required tests
- DB smoke test
- placeholder workflow smoke test
- package scripts の存在確認

### Acceptance criteria
- `test` script がある
- `test:unit` script がある
- `test:db` script がある
- `test:workflow` script がある
- `eval:smoke` script がある
- `ci:local` script がある
- fresh DB migrate + seed を通す smoke test がある

### Deliverables
- test runner setup
- package scripts
- minimal smoke tests
- local gate documentation

### Prerequisites for next ticket
- T0 acceptance criteria がすべて green
- current-ticket state file が `ready_to_stop: true`

---

## T1: prompt persistence の migration / repo / schema 整合を直す

### Goal
`generatorIntimacyMd` を含む prompt persistence を **fresh DB でも確実に round-trip** させる。

### Non-goals
- prompt の文面改善
- planner/generator/ranker の意味変更
- CoE/PAD の改善

### Invariants
- schema と repo と migration が一致する
- prompt bundle と workspace draft の両方で round-trip する
- SQL column error を出さない

### Required tests
- prompt bundle round-trip contract test
- workspace draft round-trip contract test
- fresh DB smoke test

### Acceptance criteria
- prompt bundle persistence で `generatorIntimacyMd` が保存・取得される
- workspace draft persistence で `generatorIntimacyMd` が保存・取得される
- fresh DB migrate + seed + draft init が通る
- read path / write path / migration に drift がない

### Deliverables
- migration fix
- repository mapping fix
- contract tests
- fresh DB verification

### Prerequisites for next ticket
- T1 acceptance criteria がすべて green
- T1 review が pass
- current-ticket state file が `ready_to_stop: true`

---

## T2: prompt source-of-truth を一本化する

### Goal
planner / generator / ranker の prompt contract を runtime schema に一致させる。

### Non-goals
- emotion core の設計変更
- ranking behavior の redesign
- phase logic の変更

### Invariants
- runtime schema が canonical
- checked-in prompt assets は schema に一致する
- seed/default prompts も schema に一致する
- drift を contract test で検出できる

### Required tests
- planner prompt contract test
- generator prompt contract test
- ranker prompt contract test
- seed/default prompt contract test

### Acceptance criteria
- planner prompt examples が `TurnPlanSchema` と一致する
- generator prompt examples が generator output schema と一致する
- ranker prompt examples が ranker output schema と一致する
- checked-in prompts と seed/default prompts の drift を検知する test がある
- 古い field 名が active path に残っていない

### Deliverables
- prompt asset correction
- seed/default prompt correction
- contract tests
- canonical prompt contract note

### Prerequisites for next ticket
- T2 acceptance criteria がすべて green
- drift が監査で指摘されない
- current-ticket state file が `ready_to_stop: true`

---

## T3: emotion contracts を先に定義する

### Goal
CoE-driven emotion core のための型契約と fixture 群を追加する。  
この段階では production wiring はまだしない。

### Non-goals
- production の wiring
- sandbox の wiring
- ranking redesign

### Invariants
- 現行 runtime はまだ動き続ける
- 新 contracts は deterministic test 可能
- live model call に依存しない

### Required contracts
- `CoEEvidence`
- `RelationalAppraisal`
- `EmotionUpdateProposal`
- `PairMetricDelta`
- `EmotionTrace`

### Required fixtures
- compliment
- mild rejection
- explicit insult
- apology
- repair
- repeated pressure
- intimacy escalation with positive context
- intimacy escalation across a boundary
- topic shift after tension
- two-turn carry-over
- five-turn progression

### Required assertions per fixture
- evidence shape
- appraisal axes
- PAD delta band
- pair metric delta band

### Acceptance criteria
- 必須型契約が定義される
- 必須 fixture がすべて存在する
- fixture は live model なしで再現可能
- この段階では runtime wiring を変えない

### Deliverables
- typed schemas
- fixture set
- regression harness
- adapter seams for later tickets

### Prerequisites for next ticket
- T3 fixtures が安定して green
- runtime wiring に accidental change がない
- current-ticket state file が `ready_to_stop: true`

---

## T4: CoE Evidence Extractor を作る

### Goal
パターンマッチではなく、構造化 evidence を取り出す新経路を作る。

### Non-goals
- production の main path 切り替え
- old heuristic path の削除
- PAD integration 変更

### Invariants
- malformed model output を安全に扱える
- 必須入力コンテキストを受け取る
- mocked tests で CI 可能
- old path はまだ残す

### Required input
- user message
- recent dialogue
- current phase
- pair state
- working memory
- retrieved facts
- retrieved events
- retrieved threads
- open threads

### Required output
- interaction acts
- target
- polarity
- intensity
- evidence spans
- confidence
- uncertainty notes

### Required tests
- valid extraction
- malformed output repair / reject
- partial output handling
- deterministic mock-based tests

### Acceptance criteria
- dedicated CoE evidence module がある
- required input をすべて受ける
- required output をすべて返す
- invalid model output を predictably 処理する
- old heuristic path は残っている

### Deliverables
- evidence module
- parsing/validation layer
- mocked tests
- documented output schema

### Prerequisites for next ticket
- T4 mocked tests が green
- old path coexistence が確認済み
- current-ticket state file が `ready_to_stop: true`

---

## T5: PAD / pair integrator を pure module として実装する

### Goal
CoE appraisal から PAD と pair-state delta を決める deterministic integrator を作る。

### Non-goals
- production wiring
- sandbox wiring
- prompt redesign

### Invariants
- regex pattern matching を main path にしない
- pure module としてテストできる
- config / spec 駆動の重みを使う
- safety / consent / abuse だけ narrow override を許す

### Required capabilities
- decay
- inertia
- clamps
- phase modifiers
- open-thread bias
- multi-turn carry-over

### Required tests
- insult shock
- apology repair
- sustained pressure
- affectionate carry-over
- decay over quiet turns
- open-thread bias

### Acceptance criteria
- integrator は pure module
- input は CoE appraisal
- output は PAD delta + pair metric delta
- required fixtures が green
- legacy path と比較できる seam がある

### Deliverables
- integrator module
- config/spec-driven mapping
- fixture tests
- legacy comparison seam

### Prerequisites for next ticket
- T5 fixture tests が green
- legacy comparison seam が存在する
- current-ticket state file が `ready_to_stop: true`

---

## T6: production `chat_turn` を新 emotion core へ配線する

### Goal
prod の本線を `CoE evidence -> appraisal -> integrator` に置き換える。

### Non-goals
- sandbox 修正
- ranker redesign
- prompt redesign

### Invariants
- fixed placeholder をできるだけ排除する
- pair metrics を実際に更新する
- trace で evidence / appraisal / state delta を観測できる
- one-turn と three-turn integration tests がある

### Required changes
- heuristic appraisal 直結を main path から外す
- elapsed-turn / elapsed-time を実値で扱う
- phase context に real events/topics を渡す
- `pairRepo.updateState` で PAD 以外も更新する
- trace に CoE evidence / appraisal / deltas を保存する

### Required tests
- one-turn integration test
- three-turn integration test
- trace shape test
- pair-state persistence test

### Acceptance criteria
- prod `chat_turn` は新 path を使う
- trust / affinity / conflict / intimacyReadiness / PAD を一貫更新する
- placeholders が減り、実値が使われる
- trace が debugging に十分な粒度を持つ
- integration tests が green

### Deliverables
- rewired `chat_turn`
- new trace payload
- integration tests
- migration note if needed

### Prerequisites for next ticket
- T6 integration tests が green
- pair-state update が確認済み
- current-ticket state file が `ready_to_stop: true`

---

## T7: draft / sandbox を stateful にして prod parity を取る

### Goal
draft/playground を本当に stateful にし、prod と同じ emotion core を呼ばせる。

### Non-goals
- ranking redesign
- prompt redesign
- prod storage の変更

### Invariants
- sandbox は prod data と分離する
- ただし自分の session state は持ち越す
- baseline から毎回再出発しない
- reset は明示操作のみ

### Required changes
- `sandbox_pair_state` を実際に使う
- `sandbox_working_memory` を実際に使う
- draft workflow が current phase / PAD / pair metrics を引き継ぐ
- `phaseIdAfter` 固定をやめる
- prod と同じ CoE / integrator path を使う

### Required tests
- multi-turn PAD carry-over
- multi-turn pair metric carry-over
- sandbox memory persistence
- phase progression in sandbox
- prod/sandbox parity test

### Acceptance criteria
- draft で PAD が持ち越される
- draft で pair metrics が持ち越される
- draft で sandbox memory が持ち越される
- draft で phase progression が起こる
- same fixture sequence で prod/sandbox parity test が green

### Deliverables
- stateful sandbox implementation
- sandbox repo CRUD if needed
- parity tests
- explicit reset mechanism

### Prerequisites for next ticket
- T7 parity test が green
- draft baseline reset が除去済み
- current-ticket state file が `ready_to_stop: true`

---

## T8: deterministic ranker gates を前段に入れる

### Goal
LLM ranker の前に deterministic reject layer を入れる。

### Non-goals
- prompt wording polish
- emotion core redesign
- phase redesign

### Invariants
- reject すべきものは model に委ねない
- valid candidates 間の選好だけ model に委ねる
- traceability を失わない

### Required gates
- hard safety violation
- phase violation
- intimacy-decision violation
- memory contradiction
- contradiction with CoE state

### Required tests
- each gate category has at least one failing candidate test
- valid candidates proceed to model scoring
- scorecards and winner remain inspectable

### Acceptance criteria
- deterministic gates が model scoring より前に走る
- reject は deterministic
- model ranker は valid candidates のみ扱う
- tests が各 gate category をカバーする
- output / trace が inspectable

### Deliverables
- gate layer
- ranker tests
- traceability note
- compatibility note if output shape changes

### Prerequisites for next ticket
- T8 gate tests が green
- traceability が確認済み
- current-ticket state file が `ready_to_stop: true`

---

## T9: full eval と rollout gate を閉じる

### Goal
local gate と eval を仕上げて、残りの弱点を明示した rollout 判断ができる状態にする。

### Non-goals
- architecture redesign
- large-scale refactor
- new product behavior

### Invariants
- この段階では config / thresholds / flags の tuning のみ
- blocker を future improvement として隠さない
- report は repo 内で再生成可能

### Required outputs
- `ci:local` が機能する
- `eval:smoke` が機能する
- legacy/new emotion path の rollout switch がある
- final markdown report が生成される

### Final report must include
- pass/fail counts
- biggest remaining weak cases
- rollout recommendation
- default flag recommendation
- known blockers

### Acceptance criteria
- `ci:local` が通る
- `eval:smoke` が通る
- rollout switch がある
- final report が生成される
- hidden blocker がない

### Deliverables
- local quality gate
- eval runner wiring
- rollout flag
- final report

### Prerequisites for completion
- T9 acceptance criteria がすべて green
- rollout recommendation が明文化されている
- current-ticket state file が `ready_to_stop: true`

---

# 実行順序

次の順番を崩さない。

1. T0
2. T1
3. T2
4. T3
5. T4
6. T5
7. T6
8. T7
9. T8
10. T9

## 理由
- T0 がないと以降の改善を測れない
- T1/T2 がないと prompt / persistence の土台が壊れたままになる
- T3/T4/T5 で emotion core を先に pure にする
- T6/T7 で prod と draft に配線する
- T8 で ranker を安定化する
- T9 で初めて rollout 判断ができる

---

# チケット完了の定義

各 ticket は次を満たしたときのみ完了とみなす。

1. Required tests がすべて存在する
2. Acceptance criteria がすべて pass
3. 監査 AI が blocking issue なしと判定する
4. report に remaining risks が明示されている
5. 次の ticket へ進む理由が説明できる
6. `.claude/state/current-ticket.json` が完了状態である
7. `ready_to_stop` が `true`

---

# 途中で止める条件

次のどれかが起きたら、次の ticket に進まずその場で止める。

- fresh DB test が落ちる
- schema / repository / migration drift が監査で見つかる
- prod/draft parity が破れる
- checked-in prompt / seed / runtime contract drift が見つかる
- scope widening が発生する
- required tests を書かずに実装だけ進んでいる
- state file が未更新または incomplete
- review に blocking issue がある

---

# 推奨ワークフロー

## 実装
- Claude Code または Codex に ticket 本文を渡す
- 実装方針は AI に決めさせる
- ただし scope は ticket で固定する
- state file を更新しながら進める

## 監査
- 別の AI に diff と ticket を渡して監査させる
- 同じ AI に実装と監査を両方やらせない

## 人間の役割
- この PLAN.md を維持する
- acceptance criteria を固定する
- green/red を判定する
- 本当に次へ進むべきか最終判断する

---

# Claude Code 運用ルール

Claude Code を使う場合、次を前提とする。

1. `CLAUDE.md` を project memory として読む
2. `.claude/settings.json` で hooks を有効にする
3. `.claude/hooks/check-stop.py` で stop block を行う
4. `.claude/state/current-ticket.json` を ticket 状態の唯一の機械可読ソースとする

## Claude の自律性に関する方針
- Claude は実装方法を自律的に決めてよい
- Claude は ticket の prerequisite が満たされていれば次 ticket を選んでよい
- Claude は acceptance criteria や required tests を緩和してはならない
- Claude は不確実なら進まず報告する

---

# 最後に

この計画の本質は、**AI の自律性を活かしつつ、壊してはいけない契約を厳密に固定すること** にある。

- 実装方法は AI に考えさせる
- 成功条件は人間が固定する
- test / eval / fresh DB / prod-draft parity を gate にする
- ticket state file と hooks で自律遷移を制御する

この運用なら、手順を細かくマイクロマネジメントするより成功率が高く、  
同時に「雰囲気で直った」ことも防げる。
