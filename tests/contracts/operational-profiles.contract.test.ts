/**
 * T6: operational profiles contract
 *
 * Locks in the two POC profiles and verifies:
 *
 *   1. Both profiles are exported and structurally valid.
 *   2. `poc_quality_first` holds every analysis stage on the high tier
 *      (no silent drift).
 *   3. `poc_balanced_latency` lowers only memory extractor + maintenance
 *      to the fast tier.
 *   4. `defaultModelRoles` matches the recommended profile
 *      (`poc_balanced_latency`).
 *   5. Recommended profile name is documented in a constant.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultModelRoles,
  operationalProfiles,
  RECOMMENDED_PROFILE,
} from '@/mastra/providers/model-roles';

test('both operational profiles are exported', () => {
  assert.ok(operationalProfiles.poc_quality_first, 'poc_quality_first must exist');
  assert.ok(operationalProfiles.poc_balanced_latency, 'poc_balanced_latency must exist');
});

test('each profile defines the 5 required roles', () => {
  const requiredRoles = [
    'surfaceResponseHigh',
    'decisionHigh',
    'structuredPostturnFast',
    'maintenanceFast',
    'embeddingDefault',
  ];
  for (const name of Object.keys(operationalProfiles)) {
    const profile = operationalProfiles[name];
    for (const role of requiredRoles) {
      assert.ok(
        profile[role as keyof typeof profile],
        `profile "${name}" must define role "${role}"`
      );
    }
  }
});

test('poc_quality_first keeps every analysis stage on the decisionHigh model id', () => {
  const q = operationalProfiles.poc_quality_first;
  const decision = q.decisionHigh.modelId;

  assert.equal(
    q.structuredPostturnFast.modelId,
    decision,
    'quality-first: structuredPostturnFast must share decisionHigh model id'
  );
  assert.equal(
    q.maintenanceFast.modelId,
    decision,
    'quality-first: maintenanceFast must share decisionHigh model id'
  );
  assert.notEqual(
    q.surfaceResponseHigh.modelId,
    decision,
    'quality-first: surface is still on its own higher tier'
  );
});

test('poc_balanced_latency lowers memory extractor + maintenance to the fast tier', () => {
  const b = operationalProfiles.poc_balanced_latency;

  // Unless the operator explicitly overrides the fast tier via env vars,
  // the balanced profile must split structured/maintenance off from decisionHigh.
  if (!process.env.STRUCTURED_POSTTURN_MODEL) {
    assert.notEqual(
      b.structuredPostturnFast.modelId,
      b.decisionHigh.modelId,
      'balanced: structuredPostturnFast must differ from decisionHigh'
    );
  }
  if (!process.env.MAINTENANCE_MODEL) {
    assert.notEqual(
      b.maintenanceFast.modelId,
      b.decisionHigh.modelId,
      'balanced: maintenanceFast must differ from decisionHigh'
    );
  }

  // Surface and decision tiers must stay separate regardless.
  assert.notEqual(
    b.surfaceResponseHigh.modelId,
    b.decisionHigh.modelId,
    'balanced: surface and decision must stay on different tiers'
  );
});

test('defaultModelRoles matches the RECOMMENDED_PROFILE', () => {
  const recommended = operationalProfiles[RECOMMENDED_PROFILE];
  assert.ok(recommended, `RECOMMENDED_PROFILE "${RECOMMENDED_PROFILE}" must exist`);

  for (const role of Object.keys(defaultModelRoles) as Array<keyof typeof defaultModelRoles>) {
    assert.deepEqual(
      defaultModelRoles[role],
      recommended[role],
      `defaultModelRoles.${role} must equal operationalProfiles.${RECOMMENDED_PROFILE}.${role}`
    );
  }
});

test('RECOMMENDED_PROFILE is poc_balanced_latency', () => {
  // This locks in the T6 decision. Changing the recommended default
  // requires explicit eval evidence + update here.
  assert.equal(RECOMMENDED_PROFILE, 'poc_balanced_latency');
});
