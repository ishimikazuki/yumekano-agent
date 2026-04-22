/**
 * T1-optimization: Provider registry alias-split contract
 *
 * Verifies that the shared aliases (conversationHigh / analysisMedium)
 * have been split into role-scoped aliases:
 *   - surfaceResponseHigh   (generator)
 *   - decisionHigh          (planner / ranker / coeExtractor / scorers)
 *   - structuredPostturnFast (memory extractor)
 *   - maintenanceFast        (reflector / narrator / consolidation)
 *   - embeddingDefault       (vector embeddings, unchanged)
 *
 * Model IDs are still the same as T0 baseline — this is a rename +
 * semantic specialization so T2+ can tune each role independently.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultModelRoles,
  type ModelRole,
} from '@/mastra/providers/model-roles';

const REQUIRED_ROLES: ModelRole[] = [
  'surfaceResponseHigh',
  'decisionHigh',
  'structuredPostturnFast',
  'maintenanceFast',
  'embeddingDefault',
];

test('defaultModelRoles exposes the 4 split aliases + embeddingDefault', () => {
  const keys = Object.keys(defaultModelRoles) as ModelRole[];
  for (const role of REQUIRED_ROLES) {
    assert.ok(
      keys.includes(role),
      `defaultModelRoles must expose role "${role}", got: ${keys.join(', ')}`
    );
  }
});

test('legacy aliases (conversationHigh / analysisMedium) are no longer part of ModelRole', () => {
  // Type-level guard: if the union still included the old names, this cast would compile;
  // we rely on the runtime key check to fail if defaults still carry them.
  const keys = Object.keys(defaultModelRoles);
  assert.ok(
    !keys.includes('conversationHigh'),
    'conversationHigh must be replaced by surfaceResponseHigh'
  );
  assert.ok(
    !keys.includes('analysisMedium'),
    'analysisMedium must be split into decisionHigh / structuredPostturnFast / maintenanceFast'
  );
});

test('surfaceResponseHigh preserves the T0 generator model id', () => {
  const cfg = defaultModelRoles.surfaceResponseHigh;
  assert.equal(cfg.provider, 'xai', 'surfaceResponseHigh provider must stay xai');
  assert.ok(
    /grok-4/.test(cfg.modelId),
    `surfaceResponseHigh modelId "${cfg.modelId}" must still be a grok-4 variant`
  );
});

test('decisionHigh preserves a grok-4 analysis model id', () => {
  const cfg = defaultModelRoles.decisionHigh;
  assert.equal(cfg.provider, 'xai', 'decisionHigh provider must stay xai');
  assert.ok(
    /grok-4/.test(cfg.modelId),
    `decisionHigh modelId "${cfg.modelId}" must still be a grok-4 variant`
  );
});

test('structuredPostturnFast and maintenanceFast use a distinct fast tier (T2-B)', () => {
  const structured = defaultModelRoles.structuredPostturnFast;
  const maintenance = defaultModelRoles.maintenanceFast;

  assert.equal(structured.provider, 'xai');
  assert.equal(maintenance.provider, 'xai');
  assert.ok(/grok/.test(structured.modelId), 'structuredPostturnFast should use a grok model');
  assert.ok(/grok/.test(maintenance.modelId), 'maintenanceFast should use a grok model');

  // T2-B invariant: post-turn/maintenance tiers no longer share the decision model id.
  // Allow override via env vars, but the default must split off.
  if (!process.env.STRUCTURED_POSTTURN_MODEL) {
    assert.notEqual(
      structured.modelId,
      defaultModelRoles.decisionHigh.modelId,
      'T2-B: structuredPostturnFast must be on a distinct fast tier by default'
    );
  }
  if (!process.env.MAINTENANCE_MODEL) {
    assert.notEqual(
      maintenance.modelId,
      defaultModelRoles.decisionHigh.modelId,
      'T2-B: maintenanceFast must be on a distinct fast tier by default'
    );
  }
});

test('surfaceResponseHigh and decisionHigh remain on different tiers', () => {
  assert.notEqual(
    defaultModelRoles.surfaceResponseHigh.modelId,
    defaultModelRoles.decisionHigh.modelId,
    'surface (generator) and decision (planner/ranker) must stay on separate tiers'
  );
});
