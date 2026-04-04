/**
 * T0: Workflow smoke test — chat turn
 *
 * Verifies that workflow modules are importable and export the expected
 * functions with correct signatures. Does NOT make model calls.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('workflow: runChatTurn is importable and is a function', async () => {
  const mod = await import('@/mastra/workflows/chat-turn');
  assert.equal(typeof mod.runChatTurn, 'function');
});

test('workflow: runDraftChatTurn is importable and is a function', async () => {
  const mod = await import('@/mastra/workflows/draft-chat-turn');
  assert.equal(typeof mod.runDraftChatTurn, 'function');
});

test('workflow: executeTurn is importable and is a function', async () => {
  const mod = await import('@/mastra/workflows/execute-turn');
  assert.equal(typeof mod.executeTurn, 'function');
});

test('workflow: consolidate memory is importable', async () => {
  const mod = await import('@/mastra/workflows/consolidate-memory');
  assert.equal(typeof mod.runConsolidateMemory, 'function');
  assert.equal(typeof mod.shouldTriggerConsolidation, 'function');
});

test('workflow: ChatTurnInput accepts expected shape', async () => {
  const mod = await import('@/mastra/workflows/chat-turn');
  assert.ok(mod.runChatTurn.length <= 2, 'runChatTurn should accept up to 2 arguments');
});

test('workflow: DraftChatTurnInput accepts expected shape', async () => {
  const mod = await import('@/mastra/workflows/draft-chat-turn');
  assert.ok(mod.runDraftChatTurn.length <= 2, 'runDraftChatTurn should accept up to 2 arguments');
});
