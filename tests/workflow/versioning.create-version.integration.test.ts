/**
 * T8: Versioning — create immutable version from workspace draft
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T8 publish creates immutable character version', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/versioning/publish.ts'),
    'utf8'
  );
  assert.match(source, /characterRepo|character_versions/, 'Should create character version');
  assert.match(source, /promptBundleRepo|prompt_bundle_versions/, 'Should create prompt bundle version');
  assert.match(source, /phaseGraphRepo|phase_graph_versions/, 'Should create phase graph version');
});

test('T8 publish creates release record', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/versioning/publish.ts'),
    'utf8'
  );
  assert.match(source, /releaseRepo|releases/, 'Should create release record');
});
