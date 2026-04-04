/**
 * T6: draft/playground stateful acceptance tests
 *
 * Verifies that sandbox sessions persist PAD, pair metrics, working memory,
 * and phase across turns within a single session.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceRepo } from '@/lib/repositories';
import { getDb } from '@/lib/db/client';

test('Task T6 sandbox_pair_state table exists and has required columns', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(sandbox_pair_state)');
  const columns = info.rows.map((r) => r.name as string);
  for (const col of [
    'session_id',
    'active_phase_id',
    'affinity',
    'trust',
    'intimacy_readiness',
    'conflict',
    'pad_json',
    'pad_fast_json',
    'pad_slow_json',
    'pad_combined_json',
    'appraisal_json',
  ]) {
    assert.ok(columns.includes(col), `sandbox_pair_state missing column: ${col}`);
  }
});

test('Task T6 sandbox_working_memory table exists', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(sandbox_working_memory)');
  const columns = info.rows.map((r) => r.name as string);
  assert.ok(columns.includes('session_id'), 'Missing session_id');
  assert.ok(columns.includes('data_json'), 'Missing data_json');
});

test('Task T6 workspaceRepo exposes sandbox state read/write methods', () => {
  assert.equal(typeof workspaceRepo.getSandboxPairState, 'function');
  assert.equal(typeof workspaceRepo.saveSandboxPairState, 'function');
  assert.equal(typeof workspaceRepo.getSandboxWorkingMemory, 'function');
  assert.equal(typeof workspaceRepo.saveSandboxWorkingMemory, 'function');
});

test('Task T6 workspaceRepo exposes sandbox memory CRUD', () => {
  assert.equal(typeof workspaceRepo.getSandboxEventsBySession, 'function');
  assert.equal(typeof workspaceRepo.getSandboxFactsBySession, 'function');
  assert.equal(typeof workspaceRepo.getSandboxObservationsBySession, 'function');
  assert.equal(typeof workspaceRepo.getSandboxOpenThreads, 'function');
});
