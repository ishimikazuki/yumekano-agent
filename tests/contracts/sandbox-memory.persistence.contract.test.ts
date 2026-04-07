/**
 * T1: sandbox memory persistence contract
 *
 * Verifies that sandbox session, pair state, and working memory
 * can be created, persisted, and retrieved.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { workspaceRepo } from '@/lib/repositories';

const SANDBOX_TABLES = [
  'playground_sessions',
  'playground_turns',
  'sandbox_pair_state',
  'sandbox_working_memory',
  'sandbox_memory_events',
  'sandbox_memory_facts',
  'sandbox_memory_observations',
  'sandbox_memory_open_threads',
  'sandbox_memory_usage',
] as const;

test('T1: all sandbox tables exist', async () => {
  const db = getDb();
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  const tables = new Set(result.rows.map((r) => r.name as string));

  for (const table of SANDBOX_TABLES) {
    assert.ok(tables.has(table), `Missing sandbox table: ${table}`);
  }
});

test('T1: sandbox session CRUD works', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) return;

  const workspaceId = workspaces.rows[0].id as string;

  const session = await workspaceRepo.createSession({
    workspaceId,
    userId: 'test-user-t1',
  });

  assert.ok(session.id, 'Session should have id');
  assert.equal(session.workspaceId, workspaceId);
  assert.equal(session.userId, 'test-user-t1');
  assert.equal(session.isSandbox, true);

  // Verify retrieval
  const fetched = await workspaceRepo.getSession(session.id);
  assert.ok(fetched, 'Should retrieve session');
  assert.equal(fetched.id, session.id);

  // Cleanup
  await workspaceRepo.deleteSession(session.id);
});

test('T1: sandbox pair state CRUD works', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) return;

  const workspaceId = workspaces.rows[0].id as string;

  const session = await workspaceRepo.createSession({
    workspaceId,
    userId: 'test-user-t1-pair',
  });

  const defaultPad = { pleasure: 0.1, arousal: 0.2, dominance: 0.0 };
  const now = new Date();
  const pairState = await workspaceRepo.saveSandboxPairState({
    sessionId: session.id,
    activePhaseId: 'first_meeting',
    affinity: 55,
    trust: 60,
    intimacyReadiness: 10,
    conflict: 5,
    emotion: {
      fastAffect: defaultPad,
      slowMood: defaultPad,
      combined: defaultPad,
      lastUpdatedAt: now,
    },
    pad: defaultPad,
    appraisal: {
      goalCongruence: 0,
      controllability: 0.5,
      certainty: 0.5,
      normAlignment: 0,
      attachmentSecurity: 0.5,
      reciprocity: 0,
      pressureIntrusiveness: 0,
      novelty: 0.5,
      selfRelevance: 0.5,
    },
    openThreadCount: 0,
  });

  assert.ok(pairState, 'Should create pair state');
  assert.equal(pairState.activePhaseId, 'first_meeting');
  assert.equal(pairState.affinity, 55);
  assert.equal(pairState.trust, 60);

  // Verify retrieval
  const fetched = await workspaceRepo.getSandboxPairState(session.id);
  assert.ok(fetched, 'Should retrieve pair state');
  assert.equal(fetched.activePhaseId, 'first_meeting');
  assert.equal(fetched.affinity, 55);

  // Cleanup
  await workspaceRepo.deleteSession(session.id);
});

test('T1: sandbox working memory CRUD works', async () => {
  const db = getDb();
  const workspaces = await db.execute('SELECT id FROM character_workspaces LIMIT 1');
  if (workspaces.rows.length === 0) return;

  const workspaceId = workspaces.rows[0].id as string;

  const session = await workspaceRepo.createSession({
    workspaceId,
    userId: 'test-user-t1-wm',
  });

  const testMemory = workspaceRepo.getDefaultSandboxWorkingMemory();
  testMemory.preferredAddressForm = 'T1-test';
  testMemory.knownLikes = ['testing', 'contracts'];

  await workspaceRepo.saveSandboxWorkingMemory(session.id, testMemory);

  const fetched = await workspaceRepo.getSandboxWorkingMemory(session.id);
  assert.ok(fetched, 'Should retrieve working memory');
  assert.equal(fetched.preferredAddressForm, 'T1-test');
  assert.deepEqual(fetched.knownLikes, ['testing', 'contracts']);

  // Cleanup
  await workspaceRepo.deleteSession(session.id);
});

test('T1: sandbox memory tables canonical definition is in MIGRATION_002', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const migrateContent = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8');

  const migration002Match = migrateContent.match(
    /MIGRATION_002_WORKSPACES\s*=\s*`([\s\S]*?)`;/
  );
  assert.ok(migration002Match, 'MIGRATION_002_WORKSPACES should exist');
  const m002 = migration002Match[1];

  // All sandbox tables should be defined in MIGRATION_002 (canonical)
  for (const table of ['sandbox_memory_events', 'sandbox_memory_facts', 'sandbox_memory_observations', 'sandbox_memory_open_threads', 'sandbox_memory_usage']) {
    assert.ok(
      m002.includes(table),
      `MIGRATION_002 should be canonical definition for ${table}`
    );
  }
});

test('T1: MIGRATION_006 does NOT duplicate sandbox table definitions', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const migrateContent = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8');

  const migration006Match = migrateContent.match(
    /MIGRATION_006_SANDBOX_MEMORY_PARITY\s*=\s*`([\s\S]*?)`;/
  );
  assert.ok(migration006Match, 'MIGRATION_006 should exist');
  const m006 = migration006Match[1];

  // MIGRATION_006 must NOT contain CREATE TABLE for sandbox tables
  // (they are already defined in MIGRATION_002)
  for (const table of ['sandbox_memory_events', 'sandbox_memory_facts', 'sandbox_memory_observations', 'sandbox_memory_open_threads', 'sandbox_memory_usage']) {
    assert.ok(
      !m006.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `MIGRATION_006 must not duplicate CREATE TABLE for ${table} — already in MIGRATION_002`
    );
  }
});

test('T1: MIGRATION_004 does NOT duplicate columns already in MIGRATION_001/002', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const migrateContent = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8');

  const migration004Match = migrateContent.match(
    /MIGRATION_004_GENERATOR_INTIMACY_PROMPT\s*=\s*`([\s\S]*?)`;/
  );
  assert.ok(migration004Match, 'MIGRATION_004 should exist');
  const m004 = migration004Match[1];

  // MIGRATION_004 must not contain ALTER TABLE ADD COLUMN for generator_intimacy_md
  // (already in MIGRATION_001 and MIGRATION_002)
  assert.ok(
    !m004.includes('ALTER TABLE'),
    'MIGRATION_004 must not ALTER TABLE — generator_intimacy_md is already in canonical migrations 001/002'
  );
});

test('T1: MIGRATION_008 does NOT duplicate columns already in MIGRATION_001/002', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const migrateContent = readFileSync(join(process.cwd(), 'src/lib/db/migrate.ts'), 'utf8');

  const migration008Match = migrateContent.match(
    /MIGRATION_008_PROMPT_BUNDLE_PARITY\s*=\s*`([\s\S]*?)`;/
  );
  assert.ok(migration008Match, 'MIGRATION_008 should exist');
  const m008 = migration008Match[1];

  // MIGRATION_008 must not contain ALTER TABLE ADD COLUMN for emotion_appraiser_md
  // (already in MIGRATION_001 and MIGRATION_002)
  assert.ok(
    !m008.includes('ALTER TABLE'),
    'MIGRATION_008 must not ALTER TABLE — emotion_appraiser_md is already in canonical migrations 001/002'
  );
});
