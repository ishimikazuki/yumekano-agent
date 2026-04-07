/**
 * T0: ci:local coverage contract
 *
 * Verifies that ci:local includes all required gate components
 * and that eval:smoke prerequisites are documented.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readPackageScripts(): Record<string, string> {
  const pkg = JSON.parse(
    readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
  ) as PackageJson;
  return pkg.scripts ?? {};
}

// --- ci:local must include all required sub-gates ---

const CI_LOCAL_REQUIRED_GATES = [
  'test:db',
  'test:workflow',
  'test:integration',
  'test:migrations',
  'test:ranker-gates',
  'test:coe-integrator',
  'test:emotion-regression',
  'eval:smoke',
] as const;

for (const gate of CI_LOCAL_REQUIRED_GATES) {
  test(`ci:local includes ${gate}`, () => {
    const scripts = readPackageScripts();
    const ciLocal = scripts['ci:local'];
    assert.ok(ciLocal, 'ci:local must be defined');
    assert.ok(
      ciLocal.includes(gate),
      `ci:local must include ${gate}`
    );
  });
}

// --- ci:local sub-gates must not require live model ---

test('ci:local sub-gates do not require live model calls', () => {
  const scripts = readPackageScripts();
  const ciLocal = scripts['ci:local'];
  assert.ok(ciLocal, 'ci:local must be defined');

  // eval:smoke must run in offline mode
  const evalSmoke = scripts['eval:smoke'];
  assert.ok(evalSmoke, 'eval:smoke must be defined');
  assert.ok(
    evalSmoke.includes('YUMEKANO_EVAL_MODE=offline'),
    'eval:smoke must run with YUMEKANO_EVAL_MODE=offline'
  );
});

// --- Scripts role documentation must exist ---

test('test scripts role documentation exists', () => {
  const docsPath = path.join(process.cwd(), 'docs', 'TEST_SCRIPTS.md');
  assert.ok(
    existsSync(docsPath),
    'docs/TEST_SCRIPTS.md must exist documenting script roles'
  );
});

// --- eval:smoke prerequisites are documented ---

test('eval:smoke prerequisites are documented', () => {
  const docsPath = path.join(process.cwd(), 'docs', 'TEST_SCRIPTS.md');
  if (!existsSync(docsPath)) {
    assert.fail('docs/TEST_SCRIPTS.md must exist');
    return;
  }
  const content = readFileSync(docsPath, 'utf8');
  assert.ok(
    content.includes('eval:smoke'),
    'TEST_SCRIPTS.md must document eval:smoke'
  );
  assert.ok(
    content.includes('YUMEKANO_EVAL_MODE') || content.includes('offline'),
    'TEST_SCRIPTS.md must document eval:smoke offline mode prerequisite'
  );
});
