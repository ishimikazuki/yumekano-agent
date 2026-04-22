# 2026-04-22 — T0–T6 latency optimization + T-A/T-B/T-D conversation depth (letter stream 完走)

## Goal
- `optimization_tickets_plan.md` (T0–T6) を全チケット green にして POC default profile を確定する
- 並行して会話深化ワークストリーム（T-A..T-E）も最後まで完走する
- merge to main → prod reflect

## Done

### Numeric stream (T0–T6)
- **T0**: stage latency + model-routing を trace に記録。`stageLatencies` / `modelAliases` / `modelIds` フィールド追加。3 baseline tests (latency-trace / model-routing / baseline-quality snapshot)。
- **T1**: `ModelRole` 共有 alias を責務別に分割
  - `surfaceResponseHigh` (generator)
  - `decisionHigh` (planner / ranker / CoE extractor / scorers)
  - `structuredPostturnFast` (memory extractor)
  - `maintenanceFast` (reflector / narrator / persona compiler)
  - `embeddingDefault`
  - callsite contract test で drift 検出
- **T2 (A/B/C)**: `structuredPostturnFast` + `maintenanceFast` を `grok-4-fast-reasoning` に降ろす。env var (`STRUCTURED_POSTTURN_MODEL` / `MAINTENANCE_MODEL`) でロールバック可。
- **T3**: consolidation を `after()` 経由で hot path から切り離し。`shouldTriggerConsolidation` に `salienceFloor` option 追加（低重要度ターンは 2× threshold まで抑制）。consolidationTask → chat/draft-chat route で `after()` schedule。
- **T4**: 既存 gate / migration / legacy cleanup テストを verify（前回セッション issue-0015 で完了済み）。
- **T5**: decision stack ablation → planner / ranker / CoE extractor 全 **据え置き判定**。offline eval が fixture-based で live 差を測れないため live A/B 要求を明記。`t5-decision-stack-report.md`。
- **T6**: `operationalProfiles.{poc_quality_first, poc_balanced_latency}` 定義。`RECOMMENDED_PROFILE = 'poc_balanced_latency'` 定数。`defaultModelRoles` 自動同期を contract test で lock-in。`t6-final-profile-report.md`。

### Letter stream (T-A / T-B / T-D 完走)
- **T-A**: `DialogueActSchema` に `self_disclose` / `show_vulnerability` 追加。planner system prompt に "Introspective Acts (T-A)" block 追加（"引く" side of push-pull、dominance downward を明記）。phase-engine backward compat regression。
- **T-B**: CoE integrator に `vulnerabilitySignal` axis 追加
  - `RelationalAppraisalSchema.vulnerabilitySignal` は `.optional()`（backward compat）
  - `RelationalAxisWeightsSchema.vulnerabilitySignal` は `.default(0)`
  - `DEFAULT_COE_INTEGRATOR_CONFIG` 全 7 block に重み定義
  - key signs: `dominance: -0.18`（自己開示 → D↓）、`trust: +2.2`（trust↑）
  - `buildRelationalSignals` passthrough、圧力下では減衰
- **T-D**: planner push-pull prompt は T-A 実装で既に満たされており、scenario test で lock-in。seira authored examples の 3+ 件は T-E 実装分が相乗り。

### infra / tooling fix
- `.claude/hooks/start-ticket.py` の parser bug 修正：`next_section_re` が numeric (T\d+) / letter (T-[A-Z]) 両方の境界を認識。これで複数 stream parallel 進行時に acceptance 吸い込み事故が起きなくなる。
- T-E cafe_to_walk 遷移変更に伴う `draft-chat-stateful.test.ts` の期待値を `walk_after_cafe` に同期（cross-stream cleanup）。

## Merged to main
- **PR #1** — `feature/t-e-conversation-depth → main`（squash merge）
- **merge commit**: `41ef1e3 feat: conversation depth (T-E + T-C) and latency optimization (T0–T6) (#1)`
- **feature branch**: 削除済み
- Vercel prod deploy: 自動 trigger

## Discoveries
- 2026-04-22: parser bug (numeric-only boundary regex) が原因で T6 init 時に T-A..T-E の acceptance criteria が T6 scope に混入していた。根本原因は `start-ticket.py` 1 行の regex。
- 2026-04-22: offline eval (YUMEKANO_EVAL_MODE=offline) は fixture-based で LLM を呼ばない → decision stack の live ablation は本 repo では不可能。T5 は「据え置き + live A/B 推奨」で honest に判定。
- 2026-04-22: T-D の acceptance は T-A (prompt block) + T-E (authored examples) の成果で既に satisfied。TDD の「赤から始める」に厳密には沿わないが、lock-in test として位置づけた。
- 2026-04-22: schema 拡張で `.default(0)` vs `.optional()` の選択が既存 fixtures の型影響を決める。`.optional()` + `?? 0` fallback にすることで 15+ fixture の機械的修正を回避。

## Decisions
- 2026-04-22: `RECOMMENDED_PROFILE = 'poc_balanced_latency'` を POC 運用デフォルトに。quality-first は rollback profile として保持。
- 2026-04-22: decision stack (planner / ranker / CoE) の tier lowering は live A/B 前には変更しない。env var overrides は operator experimentation 用に用意する（`PLANNER_MODEL` / `RANKER_MODEL` / `COE_EXTRACTOR_MODEL` は T5 段階では未配線 — T-E で `STRUCTURED_POSTTURN_MODEL` / `MAINTENANCE_MODEL` のみ）。
- 2026-04-22: T-B の `vulnerabilitySignal` axis は schema 側 optional + default 0 で backward compat を厳守。既存 offline eval / emotion regression がすべて green で維持されていることを確認。
- 2026-04-22: squash merge を採用（main の commit 履歴形式に合わせる）。

## Notes
- 新テスト追加数: 20 ファイル（contract / regression / integration / unit / eval）
- test pass 数: T0–T6 + T-A/B/D で + 90 assertions 程度
- ci:local: all green（emotion regression 91/91、eval:smoke 10/10）
- typecheck: clean

## Next steps（もし再開するなら）
- prod DB の seira を新 persona に republish: `DATABASE_URL=<prod> npx tsx src/scripts/republish-seira.ts`
- live A/B ablation infra（decision stack tier lowering）を別チケットで検討
- `src/app/api/debug-columns/` が untracked で残ってる。prod 運用で必要かかーくんに確認、不要なら削除 or `.gitignore` 追加
