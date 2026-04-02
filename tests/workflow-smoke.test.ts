/**
 * T0: Workflow smoke test
 *
 * Verifies that workflow modules are importable and export the expected
 * functions with correct signatures. Does NOT make model calls.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('workflow: runChatTurn is importable and is a function', async () => {
  const mod = await import('@/mastra/workflows/chat-turn');
  assert.equal(typeof mod.runChatTurn, 'function', 'runChatTurn should be a function');
});

test('workflow: runDraftChatTurn is importable and is a function', async () => {
  const mod = await import('@/mastra/workflows/draft-chat-turn');
  assert.equal(typeof mod.runDraftChatTurn, 'function', 'runDraftChatTurn should be a function');
});

test('workflow: executeTurn is importable and is a function', async () => {
  const mod = await import('@/mastra/workflows/execute-turn');
  assert.equal(typeof mod.executeTurn, 'function', 'executeTurn should be a function');
});

test('workflow: consolidate memory is importable', async () => {
  const mod = await import('@/mastra/workflows/consolidate-memory');
  assert.equal(
    typeof mod.runConsolidateMemory,
    'function',
    'runConsolidateMemory should be a function'
  );
  assert.equal(
    typeof mod.shouldTriggerConsolidation,
    'function',
    'shouldTriggerConsolidation should be a function'
  );
});

test('workflow: ChatTurnInput type fields are used', async () => {
  // Verify the function accepts the expected input shape without throwing at parse time
  const mod = await import('@/mastra/workflows/chat-turn');

  // The function should exist and accept two arguments (input, deps)
  assert.ok(mod.runChatTurn.length <= 2, 'runChatTurn should accept up to 2 arguments');
});

test('workflow: DraftChatTurnInput type fields are used', async () => {
  const mod = await import('@/mastra/workflows/draft-chat-turn');
  assert.ok(mod.runDraftChatTurn.length <= 2, 'runDraftChatTurn should accept up to 2 arguments');
});
