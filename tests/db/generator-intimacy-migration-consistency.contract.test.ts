import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('generatorIntimacy is defined in canonical migrations (001 and 002)', () => {
  const migrateTs = readFileSync(
    path.join(process.cwd(), 'src', 'lib', 'db', 'migrate.ts'),
    'utf8'
  );

  // MIGRATION_001 should define generator_intimacy_md in prompt_bundle_versions CREATE TABLE
  const m001Match = migrateTs.match(/MIGRATION_001_INITIAL\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m001Match, 'MIGRATION_001_INITIAL should exist');
  assert.ok(
    m001Match[1].includes('generator_intimacy_md'),
    'MIGRATION_001 (prompt_bundle_versions) should include generator_intimacy_md'
  );

  // MIGRATION_002 should define generator_intimacy_md in workspace_draft_state CREATE TABLE
  const m002Match = migrateTs.match(/MIGRATION_002_WORKSPACES\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m002Match, 'MIGRATION_002_WORKSPACES should exist');
  assert.ok(
    m002Match[1].includes('generator_intimacy_md'),
    'MIGRATION_002 (workspace_draft_state) should include generator_intimacy_md'
  );

  // MIGRATION_004 should be a no-op (superseded)
  const m004Match = migrateTs.match(/MIGRATION_004_GENERATOR_INTIMACY_PROMPT\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m004Match, 'MIGRATION_004 should exist');
  assert.ok(
    !m004Match[1].includes('ALTER TABLE'),
    'MIGRATION_004 should be no-op (superseded by 001/002)'
  );
});
