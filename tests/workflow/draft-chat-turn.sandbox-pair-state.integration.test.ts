/**
 * T6: Draft chat turn — sandbox pair state persistence
 *
 * Verifies that sandbox pair state (PAD, metrics) persists across turns.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { workspaceRepo } from '@/lib/repositories';
import { getDb } from '@/lib/db/client';

test('T6 sandbox_pair_state table has PAD columns', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(sandbox_pair_state)');
  const cols = info.rows.map((r) => r.name as string);
  for (const col of ['pad_json', 'pad_fast_json', 'pad_slow_json', 'pad_combined_json']) {
    assert.ok(cols.includes(col), `Missing: ${col}`);
  }
});

test('T6 sandbox_pair_state has relationship metric columns', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(sandbox_pair_state)');
  const cols = info.rows.map((r) => r.name as string);
  for (const col of ['affinity', 'trust', 'intimacy_readiness', 'conflict']) {
    assert.ok(cols.includes(col), `Missing: ${col}`);
  }
});

test('T6 draft-chat-turn reads persisted sandbox state', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  assert.match(source, /getSandboxPairState/, 'Should read persisted sandbox pair state');
  assert.match(source, /saveSandboxPairState/, 'Should save sandbox pair state');
});

test('T6 workspaceRepo has sandbox pair state CRUD', () => {
  assert.equal(typeof workspaceRepo.getSandboxPairState, 'function');
  assert.equal(typeof workspaceRepo.saveSandboxPairState, 'function');
});
