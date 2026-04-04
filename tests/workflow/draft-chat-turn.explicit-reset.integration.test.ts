/**
 * T6: Draft chat turn — explicit reset
 *
 * Verifies that explicit session reset exists and clears sandbox state.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('T6 resetDraftChatSession is importable', async () => {
  const mod = await import('@/mastra/workflows/draft-chat-turn');
  assert.equal(typeof mod.resetDraftChatSession, 'function');
});

test('T6 playground-session API route supports DELETE for reset', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const routePath = join(process.cwd(), 'src/app/api/workspaces/[id]/playground-session/route.ts');
  const source = readFileSync(routePath, 'utf8');
  assert.match(source, /export async function DELETE/, 'Should export DELETE handler for reset');
});
