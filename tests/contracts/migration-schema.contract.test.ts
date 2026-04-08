/**
 * T1: Migration schema contract test
 *
 * Verifies consistency between:
 * - migrate.ts inline SQL (runtime canonical)
 * - SQL files on disk (reference)
 * - Repository column expectations
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const MIGRATE_TS_PATH = path.join(process.cwd(), 'src', 'lib', 'db', 'migrate.ts');
const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations');

function readMigrateTs(): string {
  return readFileSync(MIGRATE_TS_PATH, 'utf8');
}

// --- Superseded SQL files match no-op state in migrate.ts ---

const SUPERSEDED_MIGRATIONS = [
  { file: '004_generator_intimacy_prompt.sql', constant: 'MIGRATION_004_GENERATOR_INTIMACY_PROMPT' },
  { file: '006_sandbox_memory_parity.sql', constant: 'MIGRATION_006_SANDBOX_MEMORY_PARITY' },
  { file: '008_prompt_bundle_parity.sql', constant: 'MIGRATION_008_PROMPT_BUNDLE_PARITY' },
];

for (const { file, constant } of SUPERSEDED_MIGRATIONS) {
  test(`T1: SQL file ${file} is marked superseded (no DDL)`, () => {
    const filePath = path.join(MIGRATIONS_DIR, file);
    assert.ok(existsSync(filePath), `${file} should exist on disk`);
    const content = readFileSync(filePath, 'utf8');
    assert.ok(
      !content.includes('ALTER TABLE') && !content.includes('CREATE TABLE'),
      `${file} should not contain DDL (it is superseded)`
    );
    assert.ok(
      content.toUpperCase().includes('SUPERSEDED'),
      `${file} should contain SUPERSEDED comment`
    );
  });

  test(`T1: migrate.ts ${constant} is no-op`, () => {
    const migrateTs = readMigrateTs();
    const match = migrateTs.match(new RegExp(`${constant}\\s*=\\s*\`([\\s\\S]*?)\`;`));
    assert.ok(match, `${constant} should exist in migrate.ts`);
    const body = match[1].trim();
    assert.ok(
      !body.includes('ALTER TABLE') && !body.includes('CREATE TABLE'),
      `${constant} should be no-op in migrate.ts`
    );
  });
}

// --- Canonical migrations define prompt columns ---

test('T1: MIGRATION_001 defines generator_intimacy_md and emotion_appraiser_md in prompt_bundle_versions', () => {
  const migrateTs = readMigrateTs();
  const m001 = migrateTs.match(/MIGRATION_001_INITIAL\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m001, 'MIGRATION_001_INITIAL should exist');

  // Check prompt_bundle_versions CREATE TABLE has both columns
  const pbvSection = m001[1].match(/CREATE TABLE[^;]*prompt_bundle_versions[^;]*;/is);
  assert.ok(pbvSection, 'prompt_bundle_versions CREATE TABLE should exist in 001');
  assert.ok(
    pbvSection[0].includes('generator_intimacy_md'),
    '001 prompt_bundle_versions should include generator_intimacy_md'
  );
  assert.ok(
    pbvSection[0].includes('emotion_appraiser_md'),
    '001 prompt_bundle_versions should include emotion_appraiser_md'
  );
});

test('T1: MIGRATION_002 defines generator_intimacy_md and emotion_appraiser_md in workspace_draft_state', () => {
  const migrateTs = readMigrateTs();
  const m002 = migrateTs.match(/MIGRATION_002_WORKSPACES\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m002, 'MIGRATION_002_WORKSPACES should exist');

  const wdsSection = m002[1].match(/CREATE TABLE[^;]*workspace_draft_state[^;]*;/is);
  assert.ok(wdsSection, 'workspace_draft_state CREATE TABLE should exist in 002');
  assert.ok(
    wdsSection[0].includes('generator_intimacy_md'),
    '002 workspace_draft_state should include generator_intimacy_md'
  );
  assert.ok(
    wdsSection[0].includes('emotion_appraiser_md'),
    '002 workspace_draft_state should include emotion_appraiser_md'
  );
});

// --- sandbox_memory_* canonical definition is in 002 only ---

test('T1: sandbox_memory_* tables are defined only in MIGRATION_002 (not in any other migration)', () => {
  const migrateTs = readMigrateTs();

  const sandboxTables = [
    'sandbox_memory_events',
    'sandbox_memory_facts',
    'sandbox_memory_observations',
    'sandbox_memory_open_threads',
    'sandbox_memory_usage',
  ];

  // Get all migration blocks
  const migrationBlocks = [
    { name: '001', match: migrateTs.match(/MIGRATION_001_INITIAL\s*=\s*`([\s\S]*?)`;/) },
    { name: '003', match: migrateTs.match(/MIGRATION_003_VERSION_LABELS\s*=\s*`([\s\S]*?)`;/) },
    { name: '004', match: migrateTs.match(/MIGRATION_004_GENERATOR_INTIMACY_PROMPT\s*=\s*`([\s\S]*?)`;/) },
    { name: '005', match: migrateTs.match(/MIGRATION_005_RUNTIME_EMOTION_AND_TRACE\s*=\s*`([\s\S]*?)`;/) },
    { name: '006', match: migrateTs.match(/MIGRATION_006_SANDBOX_MEMORY_PARITY\s*=\s*`([\s\S]*?)`;/) },
    { name: '007', match: migrateTs.match(/MIGRATION_007_EVAL_ACTIVE_LOCK\s*=\s*`([\s\S]*?)`;/) },
    { name: '008', match: migrateTs.match(/MIGRATION_008_PROMPT_BUNDLE_PARITY\s*=\s*`([\s\S]*?)`;/) },
  ];

  for (const table of sandboxTables) {
    for (const { name, match } of migrationBlocks) {
      if (!match) continue;
      const createPattern = `CREATE TABLE IF NOT EXISTS ${table}`;
      assert.ok(
        !match[1].includes(createPattern),
        `${table} should NOT be defined in migration ${name} — only in 002`
      );
    }
  }

  // Verify they ARE in 002
  const m002 = migrateTs.match(/MIGRATION_002_WORKSPACES\s*=\s*`([\s\S]*?)`;/);
  assert.ok(m002, 'MIGRATION_002_WORKSPACES should exist');
  for (const table of sandboxTables) {
    assert.ok(
      m002[1].includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `${table} should be defined in MIGRATION_002`
    );
  }
});

// --- All migration files on disk exist ---

test('T1: all expected migration SQL files exist on disk', () => {
  const expectedFiles = [
    '001_initial.sql',
    '004_generator_intimacy_prompt.sql',
    '005_runtime_emotion_and_trace.sql',
    '006_sandbox_memory_parity.sql',
    '007_eval_active_lock.sql',
    '008_prompt_bundle_parity.sql',
  ];

  for (const file of expectedFiles) {
    assert.ok(
      existsSync(path.join(MIGRATIONS_DIR, file)),
      `Migration file ${file} should exist on disk`
    );
  }
});

// --- Repository prompt column expectations ---

test('T1: workspace-repo references canonical prompt columns', () => {
  const repoPath = path.join(process.cwd(), 'src', 'lib', 'repositories', 'workspace-repo.ts');
  assert.ok(existsSync(repoPath), 'workspace-repo.ts should exist');
  const content = readFileSync(repoPath, 'utf8');

  assert.ok(content.includes('generator_intimacy_md'), 'workspace-repo should reference generator_intimacy_md');
  assert.ok(content.includes('emotion_appraiser_md'), 'workspace-repo should reference emotion_appraiser_md');
});

test('T1: prompt-bundle-repo references canonical prompt columns', () => {
  const repoPath = path.join(process.cwd(), 'src', 'lib', 'repositories', 'prompt-bundle-repo.ts');
  assert.ok(existsSync(repoPath), 'prompt-bundle-repo.ts should exist');
  const content = readFileSync(repoPath, 'utf8');

  assert.ok(content.includes('generator_intimacy_md'), 'prompt-bundle-repo should reference generator_intimacy_md');
  assert.ok(content.includes('emotion_appraiser_md'), 'prompt-bundle-repo should reference emotion_appraiser_md');
});
