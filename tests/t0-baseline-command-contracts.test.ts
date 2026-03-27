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
    `Task T0 requires \`npm run ${name}\` to be defined in package.json`
  );
}

test('Task T0 defines npm run test:unit', () => {
  assertRequiredScript('test:unit');
});

test('Task T0 defines npm run test:integration', () => {
  assertRequiredScript('test:integration');
});

test('Task T0 defines npm run test:migrations', () => {
  assertRequiredScript('test:migrations');
});

test('Task T0 defines npm run eval:emotion', () => {
  assertRequiredScript('eval:emotion');
});

test('Task T0 defines npm run eval:full', () => {
  assertRequiredScript('eval:full');
});
