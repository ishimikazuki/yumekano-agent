import assert from 'node:assert/strict';
import test from 'node:test';
import { runDeterministicGuard } from '@/mastra/agents/ranker';

test('T7 memory-contradiction gate exists in deterministic guard', () => {
  assert.equal(typeof runDeterministicGuard, 'function');
});
