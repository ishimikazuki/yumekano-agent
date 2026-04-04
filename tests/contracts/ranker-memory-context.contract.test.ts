/**
 * T7: Ranker memory context contract
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T7 ranker input type includes retrievedMemory for memoryGrounding', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/agents/ranker.ts'),
    'utf8'
  );
  assert.match(source, /retrievedMemory/, 'RankerInput should include retrievedMemory');
  assert.match(source, /memoryGrounding/, 'Ranker should score memoryGrounding');
});

test('T7 execute-turn passes retrievedMemory to ranker', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /runRanker/, 'Should call runRanker');
  assert.match(source, /retrievedMemory/, 'Should pass retrievedMemory');
});
