# HOTFIX: PostgreSQL UNDEFINED_VALUE エラー修正

## Goal
- Vercel (PostgreSQL) 環境でplaygroundチャット時に発生する `UNDEFINED_VALUE: Undefined values are not allowed` エラーを修正

## Done
- ブラウザでエラーを再現・確認
- `postgres` npm パッケージが undefined を拒否する仕様を特定
- 3段階の修正を実施:
  1. `executeWithPostgres` に undefined→null ガード追加 (`src/lib/db/client.ts`)
  2. `store.ts` の `?? undefined` を `?? null` に修正 + 引数型修正 (`src/mastra/memory/store.ts`, `src/lib/repositories/memory-repo.ts`, `src/lib/repositories/workspace-repo.ts`)
  3. `createSandboxFact` で `JSON.stringify(input.object ?? null)` に修正（本丸）
- Vercelにデプロイ・動作確認完了

## Discoveries
- `JSON.stringify(undefined)` は文字列ではなく `undefined` を返す（これがPostgreSQLに渡されてエラーに）
- ローカルのlibSQLでは発生しない（libSQLはundefinedを許容する）
- エラーは間欠的：AIメモリ抽出でfactのobjectがundefinedになるケースでのみ発生
- Vercelの自動デプロイがgit pushで動かない設定だった → `vercel --prod` で手動デプロイ

## Decisions
- `executeWithPostgres` にグローバルガードを追加（今後の同種バグを防止）
- 個別の `JSON.stringify` 呼び出しにも `?? null` を追加（defense in depth）

## Notes
- 全テスト417/417パス
- コミット: `16f9662`, `4a63027`, `af2e30e`
