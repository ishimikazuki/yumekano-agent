/**
 * T0-optimization: Baseline quality snapshot (post-T1 split)
 *
 * Captures the current model configuration and quality baseline.
 * This snapshot serves as the comparison reference for T2+ optimizations.
 *
 * T1 update: aliases have been split into role-scoped names. The underlying
 * model IDs are unchanged — the T0 latency/quality baseline still applies.
 *
 * Update this file ONLY when intentionally changing model assignments.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultModelRoles, type ModelRole } from '@/mastra/providers/model-roles';

// --- baseline snapshot ---

const BASELINE_MODEL_SNAPSHOT: Record<
  string,
  { role: ModelRole; expectedProvider: string; expectedModelPattern: RegExp }
> = {
  generator: {
    role: 'surfaceResponseHigh',
    expectedProvider: 'xai',
    expectedModelPattern: /grok-4/,
  },
  planner: {
    role: 'decisionHigh',
    expectedProvider: 'xai',
    expectedModelPattern: /grok-4/,
  },
  ranker: {
    role: 'decisionHigh',
    expectedProvider: 'xai',
    expectedModelPattern: /grok-4/,
  },
  coeExtractor: {
    role: 'decisionHigh',
    expectedProvider: 'xai',
    expectedModelPattern: /grok-4/,
  },
  memoryExtractor: {
    role: 'structuredPostturnFast',
    expectedProvider: 'xai',
    expectedModelPattern: /grok-4/,
  },
  reflector: {
    role: 'maintenanceFast',
    expectedProvider: 'xai',
    expectedModelPattern: /grok-4/,
  },
};

const BASELINE_STAGE_ALIAS_MAP: Record<string, ModelRole> = {
  generator: 'surfaceResponseHigh',
  planner: 'decisionHigh',
  ranker: 'decisionHigh',
  coeExtractor: 'decisionHigh',
  memoryExtractor: 'structuredPostturnFast',
  reflector: 'maintenanceFast',
};

// --- tests ---

test('model roles expose the expected split aliases', () => {
  const roles = Object.keys(defaultModelRoles);
  // After T1: 4 split aliases + embeddingDefault
  assert.ok(roles.length >= 5, `Expected at least 5 model roles, got ${roles.length}`);
  assert.ok(roles.includes('surfaceResponseHigh'), 'surfaceResponseHigh must exist');
  assert.ok(roles.includes('decisionHigh'), 'decisionHigh must exist');
  assert.ok(roles.includes('structuredPostturnFast'), 'structuredPostturnFast must exist');
  assert.ok(roles.includes('maintenanceFast'), 'maintenanceFast must exist');
  assert.ok(roles.includes('embeddingDefault'), 'embeddingDefault must exist');
});

test('baseline model assignments match snapshot', () => {
  for (const [stageName, baseline] of Object.entries(BASELINE_MODEL_SNAPSHOT)) {
    const roleConfig = defaultModelRoles[baseline.role];
    assert.ok(
      roleConfig,
      `Role ${baseline.role} for stage ${stageName} must exist in defaultModelRoles`
    );
    assert.equal(
      roleConfig.provider,
      baseline.expectedProvider,
      `${stageName}: provider should be ${baseline.expectedProvider}, got ${roleConfig.provider}`
    );
    assert.ok(
      baseline.expectedModelPattern.test(roleConfig.modelId),
      `${stageName}: modelId "${roleConfig.modelId}" should match ${baseline.expectedModelPattern}`
    );
  }
});

test('stage → alias mapping baseline is consistent', () => {
  for (const [stage, expectedAlias] of Object.entries(BASELINE_STAGE_ALIAS_MAP)) {
    assert.ok(
      defaultModelRoles[expectedAlias],
      `Stage ${stage}: alias ${expectedAlias} must exist in defaultModelRoles`
    );
  }
});

test('surfaceResponseHigh and decisionHigh use different model IDs (tier separation)', () => {
  const surface = defaultModelRoles.surfaceResponseHigh;
  const decision = defaultModelRoles.decisionHigh;

  assert.notEqual(
    surface.modelId,
    decision.modelId,
    'surface (generator) and decision (planner/ranker) should use different models'
  );
});

test('T2-B invariant: post-turn / maintenance aliases split off to a fast tier', () => {
  // T2-B lowers memory extractor + maintenance to grok-4-fast-reasoning by
  // default. If STRUCTURED_POSTTURN_MODEL / MAINTENANCE_MODEL env vars are set,
  // we skip the assertion because the operator has intentionally overridden.
  const decision = defaultModelRoles.decisionHigh.modelId;
  if (!process.env.STRUCTURED_POSTTURN_MODEL) {
    assert.notEqual(
      defaultModelRoles.structuredPostturnFast.modelId,
      decision,
      'T2-B: structuredPostturnFast default must differ from decisionHigh'
    );
  }
  if (!process.env.MAINTENANCE_MODEL) {
    assert.notEqual(
      defaultModelRoles.maintenanceFast.modelId,
      decision,
      'T2-B: maintenanceFast default must differ from decisionHigh'
    );
  }
});

test('baseline snapshot captures model IDs for future comparison', () => {
  const baselineReport = {
    capturedAt: new Date().toISOString(),
    modelRoles: Object.fromEntries(
      Object.entries(defaultModelRoles).map(([role, config]) => [
        role,
        `${config.provider}/${config.modelId}`,
      ])
    ),
    stageAliasMap: BASELINE_STAGE_ALIAS_MAP,
  };

  assert.ok(baselineReport.modelRoles.surfaceResponseHigh, 'Report must include surfaceResponseHigh');
  assert.ok(baselineReport.modelRoles.decisionHigh, 'Report must include decisionHigh');
  assert.ok(baselineReport.modelRoles.structuredPostturnFast, 'Report must include structuredPostturnFast');
  assert.ok(baselineReport.modelRoles.maintenanceFast, 'Report must include maintenanceFast');
  assert.ok(baselineReport.modelRoles.embeddingDefault, 'Report must include embeddingDefault');
});
