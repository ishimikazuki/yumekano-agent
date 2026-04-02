import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readScripts(): Record<string, string> {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  return packageJson.scripts ?? {};
}

test('Task T9 defines npm run eval:smoke', () => {
  const scripts = readScripts();
  assert.ok(scripts['eval:smoke'], 'Task T9 requires `npm run eval:smoke` to be defined');
});

test('Task T9 defines npm run ci:local', () => {
  const scripts = readScripts();
  assert.ok(scripts['ci:local'], 'Task T9 requires `npm run ci:local` to be defined');
});

test('Task T9 ci:local includes eval:smoke and at least one test command', () => {
  const scripts = readScripts();
  const ciLocal = scripts['ci:local'] ?? '';
  assert.match(ciLocal, /eval:smoke/, '`ci:local` should invoke `eval:smoke`');
  assert.match(ciLocal, /test:/, '`ci:local` should include at least one targeted test command');
});
