/**
 * T6: Legacy comparison activation contract
 *
 * Verifies that:
 * - prod chat-turn passes computeLegacyComparison: true to executeTurn
 * - eval runner passes computeLegacyComparison: true to executeTurn
 * - deprecated publishDraft is removed from publish.ts
 * - drafts.ts has no active-code importers (only tests/deprecated modules)
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T6: prod chat-turn passes computeLegacyComparison: true', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/mastra/workflows/chat-turn.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('computeLegacyComparison: true') ||
      source.includes('computeLegacyComparison:true'),
    'chat-turn.ts must pass computeLegacyComparison: true to executeTurn'
  );
});

test('T6: eval runner passes computeLegacyComparison: true', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/scripts/run-emotion-relationship-evals.ts'),
    'utf8'
  );
  assert.ok(
    source.includes('computeLegacyComparison: true') ||
      source.includes('computeLegacyComparison:true'),
    'eval runner must pass computeLegacyComparison: true to executeTurn'
  );
});

test('T6: deprecated publishDraft function is removed from publish.ts', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/versioning/publish.ts'),
    'utf8'
  );
  assert.ok(
    !source.includes('export async function publishDraft'),
    'publishDraft should be removed — canonical path is publishWorkspaceDraft'
  );
  assert.ok(
    !source.includes('export function publishDraft'),
    'publishDraft should be removed — canonical path is publishWorkspaceDraft'
  );
});

test('T6: publish.ts does not import from legacy drafts module', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/lib/versioning/publish.ts'),
    'utf8'
  );
  assert.ok(
    !source.includes("from './drafts'"),
    'publish.ts should not import from ./drafts — legacy path should be removed'
  );
});

test('T6: drafts.ts has no active-code importers in src/', () => {
  function findTsFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          results.push(...findTsFiles(full));
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          results.push(full);
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  const srcDir = path.join(process.cwd(), 'src');
  const files = findTsFiles(srcDir);

  const importers: string[] = [];
  for (const file of files) {
    // Skip the drafts.ts file itself
    if (file.endsWith('versioning/drafts.ts')) continue;

    const content = readFileSync(file, 'utf8');
    if (
      content.includes("from './drafts'") ||
      content.includes("from '../versioning/drafts'") ||
      content.includes('versioning/drafts')
    ) {
      importers.push(file);
    }
  }

  assert.equal(
    importers.length,
    0,
    `drafts.ts should have no active importers in src/, found: ${importers.join(', ')}`
  );
});
