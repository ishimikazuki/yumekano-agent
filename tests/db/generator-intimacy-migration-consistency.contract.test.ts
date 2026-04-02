import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationPaths = [
  path.join(process.cwd(), 'src', 'lib', 'db', 'migrate.ts'),
  path.join(
    process.cwd(),
    'src',
    'lib',
    'db',
    'migrations',
    '004_generator_intimacy_prompt.sql'
  ),
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260323000002_generator_intimacy_prompt.sql'
  ),
];

const expectedStatements = [
  /ALTER TABLE\s+prompt_bundle_versions\s+ADD COLUMN\s+IF NOT EXISTS\s+generator_intimacy_md\s+TEXT\s+NOT NULL\s+DEFAULT\s+''/i,
  /ALTER TABLE\s+workspace_draft_state\s+ADD COLUMN\s+IF NOT EXISTS\s+generator_intimacy_md\s+TEXT\s+NOT NULL\s+DEFAULT\s+''/i,
];

const forbiddenUnguardedStatements = [
  /ALTER TABLE\s+prompt_bundle_versions\s+ADD COLUMN\s+generator_intimacy_md\s+TEXT\s+NOT NULL\s+DEFAULT\s+''/i,
  /ALTER TABLE\s+workspace_draft_state\s+ADD COLUMN\s+generator_intimacy_md\s+TEXT\s+NOT NULL\s+DEFAULT\s+''/i,
];

test('generatorIntimacy migration definitions are consistent and idempotent across active tracks', () => {
  for (const migrationPath of migrationPaths) {
    const sql = readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ').trim();

    for (const statementPattern of expectedStatements) {
      assert.match(
        sql,
        statementPattern,
        `${migrationPath} is missing idempotent generator_intimacy_md add-column statement`
      );
    }

    for (const forbiddenPattern of forbiddenUnguardedStatements) {
      assert.doesNotMatch(
        sql,
        forbiddenPattern,
        `${migrationPath} still contains unguarded generator_intimacy_md add-column statement`
      );
    }
  }
});
