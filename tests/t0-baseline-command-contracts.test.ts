import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readPackageScripts(): Record<string, string> {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf8')
  ) as PackageJson;

  return packageJson.scripts ?? {};
}

function assertRequiredScript(name: string) {
  const scripts = readPackageScripts();
  assert.ok(
    scripts[name],
    `T0 requires \`npm run ${name}\` to be defined in package.json`
  );
}

// T0 acceptance criteria from PLAN.md
test('T0: test script exists', () => {
  assertRequiredScript('test');
});

test('T0: test:unit script exists', () => {
  assertRequiredScript('test:unit');
});

test('T0: test:db script exists', () => {
  assertRequiredScript('test:db');
});

test('T0: test:workflow script exists', () => {
  assertRequiredScript('test:workflow');
});

test('T0: eval:smoke script exists', () => {
  assertRequiredScript('eval:smoke');
});

test('T0: ci:local script exists', () => {
  assertRequiredScript('ci:local');
});
