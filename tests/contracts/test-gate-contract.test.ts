/**
 * T0: Test gate semantics contract
 *
 * Verifies that each npm script has a well-defined role
 * and that scripts don't accidentally overlap or drift.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// --- test:unit must NOT be an alias for npm test ---

test('test:unit is not an alias for npm test', () => {
  const scripts = readPackageScripts();
  assert.ok(scripts['test:unit'], 'test:unit must be defined');
  assert.ok(scripts['test'], 'test must be defined');
  // test:unit must not simply delegate to `npm test`
  assert.notEqual(
    scripts['test:unit'],
    'npm test',
    'test:unit must not be "npm test" — it should run only unit/contract tests'
  );
  assert.notEqual(
    scripts['test:unit'],
    scripts['test'],
    'test:unit must not be identical to test — they have different scopes'
  );
});

// --- test:unit should only include unit and contract tests ---

test('test:unit targets only unit and contract directories', () => {
  const scripts = readPackageScripts();
  const testUnit = scripts['test:unit'];
  assert.ok(testUnit, 'test:unit must be defined');

  // Must include contracts and unit tests
  assert.ok(
    testUnit.includes('tests/contracts/') || testUnit.includes('tests/contracts/*'),
    'test:unit must include tests/contracts/'
  );
  assert.ok(
    testUnit.includes('tests/unit/') || testUnit.includes('tests/unit/*'),
    'test:unit must include tests/unit/'
  );

  // Must NOT include integration/db/workflow/evals
  assert.ok(
    !testUnit.includes('tests/db/'),
    'test:unit must not include tests/db/'
  );
  assert.ok(
    !testUnit.includes('tests/workflow/'),
    'test:unit must not include tests/workflow/'
  );
  assert.ok(
    !testUnit.includes('tests/evals/'),
    'test:unit must not include tests/evals/'
  );
});

// --- ci:local must include test:emotion-regression ---

test('ci:local includes test:emotion-regression', () => {
  const scripts = readPackageScripts();
  const ciLocal = scripts['ci:local'];
  assert.ok(ciLocal, 'ci:local must be defined');
  assert.ok(
    ciLocal.includes('test:emotion-regression'),
    'ci:local must include test:emotion-regression'
  );
});

// --- Each script must be defined ---

const REQUIRED_SCRIPTS = [
  'test',
  'test:unit',
  'test:db',
  'test:workflow',
  'test:emotion-regression',
  'ci:local',
  'eval:smoke',
] as const;

for (const name of REQUIRED_SCRIPTS) {
  test(`script "${name}" is defined`, () => {
    const scripts = readPackageScripts();
    assert.ok(scripts[name], `${name} must be defined in package.json`);
  });
}

// --- test (repo standard gate) must be the broadest local gate ---

test('test script is the broadest local gate', () => {
  const scripts = readPackageScripts();
  const testCmd = scripts['test'];
  assert.ok(testCmd, 'test must be defined');
  // The repo standard gate should include multiple directories
  const expectedDirs = ['tests/contracts/', 'tests/unit/', 'tests/db/', 'tests/workflow/'];
  for (const dir of expectedDirs) {
    assert.ok(
      testCmd.includes(dir.replace(/\/$/, '')),
      `test (repo standard gate) should include ${dir}`
    );
  }
});
