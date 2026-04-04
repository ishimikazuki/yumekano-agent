/**
 * T7: Generator memory context contract
 *
 * Verifies generator receives retrieved memory in its prompt context.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T7 generator buildGeneratorSystemPrompt references memory context', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/agents/generator.ts'),
    'utf8'
  );
  assert.match(source, /retrievedMemory|memory.*facts|memory.*events/, 'Generator should reference memory context');
});

test('T7 generator input type includes retrievedMemory', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/agents/generator.ts'),
    'utf8'
  );
  assert.match(source, /retrievedMemory/, 'GeneratorInput should include retrievedMemory');
});

test('T7 execute-turn passes retrievedMemory to generator', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/execute-turn.ts'),
    'utf8'
  );
  assert.match(source, /retrievedMemory/, 'executeTurn should pass retrievedMemory to generator');
});
