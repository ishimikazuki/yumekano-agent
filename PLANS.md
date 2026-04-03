# 現在の作業: ランタイムバグ修正 & テストカバレッジ改善

## チケット一覧

| ID | タイトル | 状態 |
|----|---------|------|
| T0 | DB マイグレーション修正 (turn_traces 欠損カラム) | pending |
| T1 | コード安全性修正 (JSON.parse / as any / エラーハンドリング) | pending |
| T2 | テストカバレッジギャップ修正 | pending |
| T3 | 全テスト再実行 & 最終確認 | pending |

---

## T0: DB マイグレーション修正

### ゴール
`/api/chat` が `SQLITE_ERROR: table turn_traces has no column named coe_extraction_json` で失敗する問題を修正する。

### 背景
- `001_initial.sql` に `coe_extraction_json`, `emotion_trace_json`, `legacy_comparison_json` の3カラムが欠けている
- `migrate.ts` の埋め込みマイグレーションには正しく含まれている
- `/api/draft-chat` は sandbox テーブルを使うため影響なし

### 受入基準
- [ ] `001_initial.sql` に3つの欠損カラムが追加されている
- [ ] `migrate.ts` の埋め込みマイグレーションと `001_initial.sql` の整合性が取れている
- [ ] fresh DB で `/api/chat` が SQLITE_ERROR なく動作する
- [ ] 既存のマイグレーションテストが全て通る

### 必要テスト
- `npm run test -- --grep "migration"` が通る
- fresh DB での `/api/chat` 手動確認

---

## T1: コード安全性修正

### ゴール
静的解析で発見されたコード安全性の問題を修正する。

### 背景 (発見 2026-04-03)
1. `JSON.parse()` 未保護箇所 (rollback route, workspace-repo)
2. `as any` 型アサーション (execute-turn.ts:368, 580)
3. Background eval run の silent failure
4. Draft-chat session の race condition
5. `request.json()` エラーハンドリングの不統一

### 受入基準
- [ ] `JSON.parse()` 呼び出しが try-catch で保護されている
- [ ] `as any` が適切な型に置き換えられている
- [ ] Background eval の失敗がログに記録される
- [ ] `request.json()` のエラーハンドリングが統一されている
- [ ] TypeScript strict チェックが通る (`npx tsc --noEmit`)

### 必要テスト
- `npm run test` 全体が通る
- `npx tsc --noEmit` が通る

---

## T2: テストカバレッジギャップ修正

### ゴール
テストカバレッジの不足を補い、信頼性を上げる。

### 背景 (発見 2026-04-03)
1. T6/T8 acceptance tests のフレーミング不足
2. Shadow report の legacy comparison が 0/15
3. Regression baseline 9/10 失敗
4. CoE reason field assertions 欠如

### 受入基準
- [ ] T6/T8 関連のテストが受入基準を正しくカバーしている
- [ ] Shadow report の legacy comparison が改善されている
- [ ] Regression baseline テストが通る
- [ ] CoE reason field の assertion が追加されている
- [ ] `npm run test` 全体が通る

### 必要テスト
- `npm run test` 全体が通る
- `npm run eval:smoke` が通る

---

## T3: 全テスト再実行 & 最終確認

### ゴール
B1-B3 の修正後、全テスト・eval を再実行して全グリーンを確認する。

### 受入基準
- [ ] `npm run test` 全テスト通過
- [ ] `npm run eval:smoke` 全ケース通過
- [ ] `npx tsc --noEmit` 型エラーなし
- [ ] fresh DB でアプリが正常起動・動作する

### 必要テスト
- `npm run test`
- `npm run eval:smoke`
- `npx tsc --noEmit`

---

## 発見・予想外のこと

- 2026-04-03: 本番チャットの致命的バグ — `001_initial.sql` に3カラム欠損
- 2026-04-03: CoE Extractor のパース精度問題 — safe fallback で confidence: 0.1
- 2026-04-03: ブラウザ Loading 問題 — browser-use ヘッドレスの制限の可能性
- 2026-04-03: コード静的解析で5つの安全性問題を発見
- 2026-04-03: テストカバレッジギャップ4件を発見

## 決定したこと

- 2026-04-03: DBマイグレーション不整合は `001_initial.sql` を修正して対応
- 2026-04-03: バグ修正をチケット形式（T0-T3）に分割して順次対応

## メモ

- テスト(142件)、ビルド、eval(10/10)は全グリーン（T0-T2 修正前の時点）
- xAI API 呼び出しは約50-70秒かかる（正常動作）
- draft-chat の返事品質は良好（蒼井セイラが適切に応答）
