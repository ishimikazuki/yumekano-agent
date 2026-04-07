/**
 * T8: Legacy draft path quarantine contract
 *
 * Verifies that:
 * - Only workspace-backed publish path is active
 * - No legacy in-memory draft/publish route exists
 * - publishWorkspaceDraft is the canonical publish function
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('T8: only one publish route exists (workspace-backed)', () => {
  // Recursively find all publish route files
  function findPublishRoutes(dir: string): string[] {
    const results: string[] = [];
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...findPublishRoutes(full));
        } else if (entry.name === 'route.ts' && dir.includes('publish')) {
          results.push(full);
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  const apiDir = path.join(process.cwd(), 'src/app/api');
  const publishRoutes = findPublishRoutes(apiDir);

  assert.equal(
    publishRoutes.length,
    1,
    `Expected exactly 1 publish route, found ${publishRoutes.length}: ${publishRoutes.join(', ')}`
  );
  assert.ok(
    publishRoutes[0].includes('workspaces'),
    'The publish route must be workspace-backed'
  );
});

test('T8: publish route uses publishWorkspaceDraft', () => {
  const routePath = path.join(
    process.cwd(),
    'src/app/api/workspaces/[id]/publish/route.ts'
  );
  const source = readFileSync(routePath, 'utf8');
  assert.match(
    source,
    /publishWorkspaceDraft/,
    'Publish route must call publishWorkspaceDraft'
  );
});

test('T8: publishWorkspaceDraft is the canonical publish function', () => {
  const publishSource = readFileSync(
    path.join(process.cwd(), 'src/lib/versioning/publish.ts'),
    'utf8'
  );
  assert.match(
    publishSource,
    /export.*publishWorkspaceDraft/,
    'publishWorkspaceDraft must be exported from versioning/publish.ts'
  );
});

test('T8: no legacy in-memory draft publish path in API routes', () => {
  // Check that no API route references a non-workspace publish function
  function readAllRouteFiles(dir: string): Array<{ path: string; content: string }> {
    const results: Array<{ path: string; content: string }> = [];
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...readAllRouteFiles(full));
        } else if (entry.name === 'route.ts') {
          results.push({ path: full, content: readFileSync(full, 'utf8') });
        }
      }
    } catch { /* ignore */ }
    return results;
  }

  const apiDir = path.join(process.cwd(), 'src/app/api');
  const routes = readAllRouteFiles(apiDir);

  for (const route of routes) {
    // No route should use a legacy publish function
    assert.ok(
      !route.content.includes('publishInMemoryDraft'),
      `${route.path} should not reference publishInMemoryDraft`
    );
  }
});
