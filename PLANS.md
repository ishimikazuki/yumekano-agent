# 現在の作業: Yumekano Agent MVP実装

## ゴール
デザイナーがコードを触らずにキャラを調整・テスト・公開できる、データ駆動・型安全・トレース可能なステートフル関係エージェントを実装する。

## 進捗

### 完了済み
- [x] Phase 0: Bootstrap
- [x] Phase 1: スキーマ・リポジトリ・DB
- [x] Phase 2: メモリシステム
- [x] Phase 3: 感情・プランニング
- [x] Phase 4: 生成・ランキング
- [x] Phase 5: ダッシュボード（全画面）
- [x] Phase 6: 評価システム（スコアラー7種、run_eval_suite）
- [x] 仕様書との差分実装完了
- [x] セイラキャラクター実装 & デバッグ
- [x] ワークスペース編集ページ実装（スプリットパネルUI）
- [x] フェーズ遷移条件エディタ
- [x] Git風バージョン管理システム（公開・ロールバック）
- [x] PAD編集UI不具合修正（emotion型の `baselinePAD` 対応 + API検証追加）
- [x] CoE感情変化説明UI（Playground/Workspace/Trace）実装
- [x] 処理フロー視覚化ドキュメント作成（非エンジニア向け）
- [x] LPとしてVercelにデプロイ (https://lp-gray-six.vercel.app)
- [x] デザイナー観点の総合デバッグ（主要ページ巡回、即時修正、再検証）
- [x] 親密時専用 Generator prompt variant の追加（runtime + dashboard）
- [x] persona authoring 簡素化 + publish-time compiledPersona 対応
- [x] appraisal sensitivity の中立点補正 + 落とし物返却シグナル追加

### 残作業
- [ ] ワークスペース会話テストの履歴復元を仕上げて検証する
- [ ] anchors/innerWorldをAPIレスポンスに含める
- [ ] E2Eテスト作成
- [ ] 本番デプロイ設定

## 次やること
1. anchors/innerWorldのAPI対応
2. 評価シナリオの拡充
3. 本番環境へのデプロイ準備

## 発見・予想外のこと
- 2026-03-23: モデル切り替え設定は `.env` の `CONVERSATION_MODEL` / `ANALYSIS_MODEL` コメントではなく、`src/mastra/providers/model-roles.ts` の固定ロール定義が実際の参照元になっていた。
- 2026-03-19: トレース画面にはPAD差分があるが、感情変化の理由（appraisal寄与とplanner意図）が明示されておらず、デザイナーの都度確認コストが高かった。
- 2026-03-19: `/api/characters` が配列を返す実装に対し、一部ダッシュボード画面（Playground / Releases / Evals）が `data.characters` 前提で読み込み、キャラクターが空表示になる不整合を確認。
- 2026-03-19: `DATABASE_URL` が Supabase(PostgreSQL) のとき、DNS解決失敗 (`ENOTFOUND`) が発生すると全APIが500化し、キャラが未作成表示になることを確認。
- 2026-03-21: `/` が初期Next.jsテンプレートのままで、デザイナー導線の開始地点として機能していなかった。
- 2026-03-21: 新規ワークスペース作成時に draft が自動生成されず、編集画面遷移で `ワークスペースが見つかりません` になる経路を確認。
- 2026-03-21: リリースのロールバックが過去バージョンをそのままLIVE参照しており、現在のリリースと `latestVersion` 表示が食い違っていた。
- 2026-03-21: メモリ画面と評価画面に stub 実装が残っており、実データ確認や評価実行ができなかった。
- 2026-03-21: 評価実行を同期APIで待たせる実装だと、1リクエストが数分ぶら下がり UI 上ほぼハングに見えることを確認。
- 2026-03-23: PAD 更新式が 0..1 appraisal の中立値 0.5 をそのまま加算しており、中立入力でも快・覚醒・支配感が上振れしやすいことを確認。
- 2026-03-23: appraisal sensitivity が 0..1 系の値全体にそのまま乗算されており、中立入力でも controllability / certainty / attachmentSecurity / novelty が 0.5 未満へ潰れて「拾ってくれたのに不快寄り」な説明が出ることを確認。
- 2026-03-23: workspace sandbox は `sandbox_pair_state` テーブルがあるのに未使用で、PAD/phase/関係メトリクスを毎ターン baseline / entry に戻していたため、表示上も挙動上も「ずっと station_meeting / ずっと同じ PAD」に見えることを確認。
- 2026-03-23: phase engine 自体はあるが、runtime から `topics / events / turnsSinceLastTransition / daysSinceEntry` をほぼ空で渡しており、さらに trust/affinity/intimacy/conflict も更新されないため、graph 条件が満たせず phase progression が止まりやすかった。
- 2026-03-23: Generator prompt が単一スロットのみで、親密時だけ表現を切り替えたくても workflow に生ファイル prompt を直書きしないと実現できない状態だった。
- 2026-03-23: `db:migrate` の `_migrations` 管理テーブル定義が libsql/SQLite 非互換で、既存 local.db への列追加 migration がそのままでは流れなかった。
- 2026-03-23: ローカル起動中の Next.js アプリは `.env` の PostgreSQL を参照しており、local.db だけ migration しても dashboard 保存確認には不十分だった。
- 2026-03-23: planner / generator は prompt bundle の文字列を丸ごと system prompt として返しており、動的に組み立てた persona ブロックが消えていた。compiledPersona を効かせるには prompt bundle を「前置き」として結合する必要があった。
- 2026-03-23: Vercel preview deploy は preview 環境変数が未設定で、ローカル `.env` の `localhost` PostgreSQL を拾って API が失敗した。production env では既存 `DATABASE_URL` が有効で、characters/workspace/draft-chat の確認は production で通った。
- 2026-03-23: ワークスペースの会話テスト履歴は `playground_turns` に保存済みだが、画面側が React state の `messages` / `sessionId` しか見ておらず、リロード時に復元されていなかった。

## 決定したこと
- 2026-03-23: `conversationHigh` は `grok-4.20-reasoning`、`analysisMedium` は `grok-4-1-fast-reasoning` に切り替える。理由: ユーザー向け返信生成は最高品質を優先しつつ、planner / ranker / extractor / eval scorer 群は高速 reasoning で総レイテンシとコストのバランスを取るため。
- 2026-03-19: CoE説明は共通ロジック（`buildCoEExplanation`）で生成し、`/api/chat` と `/api/draft-chat` から毎ターン返してUI表示する。理由: Playground/Workspace/Traceで同じ説明軸を保ち、検証観点を揃えるため。
- 2026-03-19: `GET /api/characters` のレスポンスを `{ characters }` に統一する。理由: 既存ダッシュボード画面の読み込み形式と合わせ、キャラ一覧の空表示（セイラが消えたように見える）を防ぐため。
- 2026-03-19: DBクライアントに「PostgreSQL接続失敗時の `local.db` フォールバック」を実装。理由: 開発環境ネットワーク障害時でもローカル検証を継続でき、UIが空表示で詰まるのを防ぐため。
- 2026-03-21: ルート `/` は `/characters` へ即時リダイレクトさせる。理由: ダッシュボード起点を明示し、初期テンプレート露出をなくすため。
- 2026-03-21: ワークスペース作成APIで初期 draft を必ず生成し、既存の壊れたワークスペースも GET 時に自己修復する。理由: 編集導線の 404 を止血し、既存データも救済するため。
- 2026-03-21: ロールバック時は対象バージョンを複製した新しい published version を作って LIVE にする。理由: バージョン履歴・現在リリース・画面表示を一致させるため。
- 2026-03-21: メモリ画面は実メモリAPI、評価画面はローカルシナリオ + 実行履歴APIに接続する。理由: デザイナーがダッシュボード上で実データを検証できるようにするため。
- 2026-03-21: 評価実行は `202 Accepted` で即時返却し、バックグラウンド実行 + ポーリング表示にする。理由: 数分単位の同期待ちを避け、UI をハングさせないため。
- 2026-03-21: 共通メタデータを `Yumekano Dashboard` に更新し、`lang=\"ja\"` を設定する。理由: デザイナー向け画面としてのブランド整合性とアクセシビリティを改善するため。
- 2026-03-23: PAD 寄与計算は 0..1 appraisal を中立点 0.5 基準に再中心化し、fast affect の全体ゲインを 0.5 に抑える。理由: PAD 文献の双極スケール前提と、実験で観測される小さめの変化幅に近づけるため。
- 2026-03-23: appraisal sensitivity も 0..1 系は中立点 0.5 基準で適用し、落とし物を返す/届ける系の発話は goalCongruence の前向きシグナルとして扱う。理由: 感度を下げても中立がネガティブ化しないようにしつつ、助けてもらった場面を最低限ポジティブに解釈できるようにするため。
- 2026-03-23: sandbox では `sandbox_pair_state` に PAD / activePhase / relationship metrics を保存し、次ターンはその状態から再開する。理由: 会話テストで感情とフェーズが連続して変化する本来の体験に戻すため。
- 2026-03-23: phase engine への `topics / events / time` 入力は共通 helper で補完し、engine が妥当な遷移を返したときは planner が target を空欄でも phase を進める。理由: graph を authority に保ちつつ、planner の書き漏れだけで遷移が凍結しないようにするため。
- 2026-03-23: trust / affinity / intimacyReadiness / conflict は appraisal ベースの小さなデルタで毎ターン更新する。理由: high-threshold な phase edge が永遠に満たせない状態を解消し、関係進行を stateful にするため。
- 2026-03-23: 親密時専用の生成指示は `generatorIntimacyMd` として prompt bundle / workspace draft に保存し、`intimacyDecision` が `accept` / `conditional_accept` のときだけ選択する。理由: workflow にハードコードせず、ダッシュボード編集・公開版バージョン管理・draft/prod 一貫性を保つため。
- 2026-03-23: `_migrations` 管理テーブルは DB 共通SQLに寄せ、既存 local.db に 004 migration を適用できるようにする。理由: libsql 開発環境でも新しい prompt variant 列を安全に追加できるようにするため。
- 2026-03-23: ローカル検証時は `.env` の PostgreSQL にも 004 migration を適用してから dashboard 保存を確認する。理由: 実際に起動中アプリが使っている保存先とスキーマを一致させるため。
- 2026-03-23: persona の編集面は `summary` / `innerWorldNoteMd` / `vulnerabilities` / `authoredExamples` を中心に簡素化し、旧 `innerWorld` / `surfaceLoop` / `anchors` / `topicPacks` / `reactionPacks` は `legacyAuthoring` に退避して読み取り互換を維持する。理由: 非エンジニア向け編集体験を軽くしつつ、既存 draft/version を壊さず publish-time に低トークンな runtime persona を作るため。
- 2026-03-23: デプロイ確認は production alias `yumekano-codex-spec-v2.vercel.app` で行い、workspace の保存・draft-chat までを確認する。理由: preview では Vercel の preview env 未設定により DB 接続検証が成立しなかったため。
- 2026-03-23: 会話テスト履歴の継続は `workspace_editor_context.playgroundSessionId` を保存し、`playground_turns` から復元する。理由: 既存の永続化基盤を再利用して、リロードでは消えず、リセット時だけ明示的に切り替わる挙動にするため。

## 既知の問題
- xAI APIの応答に10-30秒かかることがある
- 食べ物の好み（イチゴタルト）がプロンプトに弱い反映

## 発見・予想外のこと
- 2026-03-19: ワークスペース感情タブのUIが旧型(`baseline`)のままで、現行スキーマ(`baselinePAD`)と不一致。感情タブ遷移時にクラッシュし、PAD編集不能になっていた。
- 2026-03-19: バックエンドの `/api/draft-chat` では PAD更新ロジック自体は正常に動作しており、問題は主にUI側のキー不一致だった。
- 2026-03-19: ワークスペース編集UIの `autonomy`/`style` が現行スキーマと不一致（`disagreementReadiness` など）で、保存後に `DraftStateSchema` パースが失敗し画面が落ちる経路を確認。
- 2026-03-19: 一部既存ドラフトが旧emotion構造（`baseline` など）を保持しており、`感情`タブ描画時の参照でランタイムエラー化するケースがあった。

## 決定したこと
- 2026-03-19: 感情UIを `baselinePAD` ベースに統一し、保存APIで `emotion` セクションに `EmotionSpecSchema` 検証を追加。理由: 再発防止（不正フォーマット保存による破損）とクラッシュ解消を同時に満たすため。
- 2026-03-19: ワークスペース保存APIで全セクションをスキーマ検証し、`workspaceRepo.getDraft` で旧キーを後方互換変換する。理由: 既存の破損ドラフトを読めるようにしつつ、新規破損の書き込みを防ぐため。
- 2026-03-19: `emotion` も後方互換正規化（旧キー→新キー + 欠損補完）を追加し、UI側にも描画ガードを入れる。理由: 既存データ由来クラッシュを即時止血し、再保存までの可用性を確保するため。

## 詳細ログ
- PROJECT_LOG/2026-03-19-version-management.md
- PROJECT_LOG/2026-03-18-seira-debug-and-editor.md
- PROJECT_LOG/2026-03-17-spec-gap-implementation.md
- PROJECT_LOG/2026-03-17-mvp-implementation.md
