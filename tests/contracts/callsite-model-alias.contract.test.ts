/**
 * T1-optimization: Call-site model alias contract
 *
 * Verifies that each pipeline call-site uses the correct role alias
 * after the T1 split. This locks in the "which stage uses which alias"
 * contract so alias drift surfaces as a test failure.
 *
 * Strategy: scan source files for `registry.getModel('...')` / `registry.getModelInfo('...')`
 * and assert the alias matches the role the file is responsible for.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readSource(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

function assertUsesAlias(relPath: string, alias: string, description: string) {
  const src = readSource(relPath);
  const pattern = new RegExp(
    `registry\\.(getModel|getModelInfo)\\(\\s*['"]${alias}['"]\\s*\\)`
  );
  assert.ok(
    pattern.test(src),
    `${description}: expected ${relPath} to call registry.getModel('${alias}')`
  );
}

function assertDoesNotUseAlias(relPath: string, forbiddenAliases: string[]) {
  const src = readSource(relPath);
  for (const alias of forbiddenAliases) {
    const pattern = new RegExp(
      `registry\\.(getModel|getModelInfo)\\(\\s*['"]${alias}['"]\\s*\\)`
    );
    assert.ok(
      !pattern.test(src),
      `${relPath} must not use legacy alias '${alias}' after T1 split`
    );
  }
}

// --- generator uses surfaceResponseHigh ---

test('generator.ts uses surfaceResponseHigh', () => {
  assertUsesAlias(
    'src/mastra/agents/generator.ts',
    'surfaceResponseHigh',
    'generator is the direct user-facing surface'
  );
});

// --- decision-tier stages use decisionHigh ---

test('planner.ts uses decisionHigh', () => {
  assertUsesAlias(
    'src/mastra/agents/planner.ts',
    'decisionHigh',
    'planner is part of the decision stack'
  );
});

test('ranker.ts uses decisionHigh', () => {
  assertUsesAlias(
    'src/mastra/agents/ranker.ts',
    'decisionHigh',
    'ranker is part of the decision stack'
  );
});

test('coe-evidence-extractor.ts uses decisionHigh', () => {
  assertUsesAlias(
    'src/mastra/agents/coe-evidence-extractor.ts',
    'decisionHigh',
    'CoE extractor drives internal state transitions (decision tier)'
  );
});

// --- post-turn structured stage ---

test('memory-extractor.ts uses structuredPostturnFast', () => {
  assertUsesAlias(
    'src/mastra/agents/memory-extractor.ts',
    'structuredPostturnFast',
    'memory extractor runs after the user-facing reply is finalized'
  );
});

// --- maintenance tier ---

test('reflector.ts uses maintenanceFast', () => {
  assertUsesAlias(
    'src/mastra/agents/reflector.ts',
    'maintenanceFast',
    'reflector is post-turn maintenance'
  );
});

test('emotion-narrator.ts uses maintenanceFast', () => {
  assertUsesAlias(
    'src/mastra/agents/emotion-narrator.ts',
    'maintenanceFast',
    'emotion narrator generates narrative after the turn (maintenance)'
  );
});

// --- scorers: decision tier because they shape candidate selection ---

const SCORER_PATHS = [
  'src/mastra/scorers/persona-consistency.ts',
  'src/mastra/scorers/phase-compliance.ts',
  'src/mastra/scorers/memory-grounding.ts',
  'src/mastra/scorers/emotional-coherence.ts',
  'src/mastra/scorers/autonomy.ts',
  'src/mastra/scorers/refusal-naturalness.ts',
  'src/mastra/scorers/contradiction-penalty.ts',
];

for (const scorerPath of SCORER_PATHS) {
  test(`${scorerPath} uses decisionHigh`, () => {
    assertUsesAlias(
      scorerPath,
      'decisionHigh',
      'scorers feed the ranker decision'
    );
  });
}

// --- design-time tool: maintenance tier ---

test('persona.ts (compilePersonaAuthoring) uses maintenanceFast', () => {
  assertUsesAlias(
    'src/lib/persona.ts',
    'maintenanceFast',
    'persona compilation is a design-time maintenance task'
  );
});

// --- no legacy alias references remain ---

const LEGACY_ALIASES = ['conversationHigh', 'analysisMedium'];
const ALL_CALLSITES = [
  'src/mastra/agents/generator.ts',
  'src/mastra/agents/planner.ts',
  'src/mastra/agents/ranker.ts',
  'src/mastra/agents/coe-evidence-extractor.ts',
  'src/mastra/agents/memory-extractor.ts',
  'src/mastra/agents/reflector.ts',
  'src/mastra/agents/emotion-narrator.ts',
  'src/lib/persona.ts',
  ...SCORER_PATHS,
];

for (const path of ALL_CALLSITES) {
  test(`${path} uses no legacy alias`, () => {
    assertDoesNotUseAlias(path, LEGACY_ALIASES);
  });
}
