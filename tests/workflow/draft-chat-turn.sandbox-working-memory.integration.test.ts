/**
 * T6: Draft chat turn — sandbox working memory persistence
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { workspaceRepo } from '@/lib/repositories';
import { getDb } from '@/lib/db/client';

test('T6 sandbox_working_memory table exists', async () => {
  const db = getDb();
  const info = await db.execute('PRAGMA table_info(sandbox_working_memory)');
  assert.ok(info.rows.length > 0, 'sandbox_working_memory should exist');
  const cols = info.rows.map((r) => r.name as string);
  assert.ok(cols.includes('session_id'));
  assert.ok(cols.includes('data_json'));
});

test('T6 draft-chat-turn uses sandbox memory store for working memory', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/draft-chat-turn.ts'),
    'utf8'
  );
  assert.match(source, /getOrCreateWorkingMemory/, 'Should retrieve working memory');
  assert.match(source, /createSandboxMemoryStore/, 'Should use sandbox memory store');
});

test('T6 workspaceRepo has sandbox working memory CRUD', () => {
  assert.equal(typeof workspaceRepo.getSandboxWorkingMemory, 'function');
  assert.equal(typeof workspaceRepo.saveSandboxWorkingMemory, 'function');
});
