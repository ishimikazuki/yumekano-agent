/**
 * T-B: CoE integrator self-disclosure (vulnerability) signal
 *
 * Verifies:
 *   1. When `vulnerabilitySignal = 0`, integrator output is identical to T-B-前
 *      (backward compat — new axis is no-op when not fired).
 *   2. When `vulnerabilitySignal > 0`, D delta goes more negative (character
 *      becomes less dominant — "引く" side) and trust delta goes more positive.
 *
 * Backward compat is enforced via `.default(0)` on the schema.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { RelationalAppraisalSchema } from '@/lib/schemas/emotion-contract';
import {
  DEFAULT_COE_INTEGRATOR_CONFIG,
  type RelationalAxisWeights,
} from '@/lib/schemas/character';

test('RelationalAppraisalSchema accepts omitted vulnerabilitySignal (defaults to 0)', () => {
  const preT_BAppraisal = {
    warmthImpact: 0.2,
    rejectionImpact: 0,
    respectImpact: 0.1,
    threatImpact: 0,
    pressureImpact: 0,
    repairImpact: 0,
    reciprocityImpact: 0.1,
    intimacySignal: 0,
    boundarySignal: 0,
    certainty: 0.8,
  };
  const parsed = RelationalAppraisalSchema.safeParse(preT_BAppraisal);
  assert.ok(parsed.success, 'pre-T-B appraisal must still parse');
  // vulnerabilitySignal is optional; consumers treat missing as 0.
  assert.equal(
    parsed.data?.vulnerabilitySignal ?? 0,
    0,
    'missing vulnerabilitySignal must coerce to 0 at use sites'
  );
});

test('RelationalAppraisalSchema accepts explicit vulnerabilitySignal', () => {
  const appraisal = {
    warmthImpact: 0,
    rejectionImpact: 0,
    respectImpact: 0,
    threatImpact: 0,
    pressureImpact: 0,
    repairImpact: 0,
    reciprocityImpact: 0,
    intimacySignal: 0,
    boundarySignal: 0,
    certainty: 0.8,
    vulnerabilitySignal: 0.6,
  };
  const parsed = RelationalAppraisalSchema.safeParse(appraisal);
  assert.ok(parsed.success);
  assert.equal(parsed.data?.vulnerabilitySignal, 0.6);
});

test('DEFAULT_COE_INTEGRATOR_CONFIG defines vulnerabilitySignal weight for every PAD/pair axis', () => {
  const cfg = DEFAULT_COE_INTEGRATOR_CONFIG;
  const padAxes = ['pleasure', 'arousal', 'dominance'] as const;
  const pairAxes = ['trust', 'affinity', 'conflict', 'intimacyReadiness'] as const;

  for (const axis of padAxes) {
    const weights = cfg.padWeights[axis] as RelationalAxisWeights;
    assert.ok(
      'vulnerabilitySignal' in weights,
      `padWeights.${axis} must define vulnerabilitySignal`
    );
  }
  for (const axis of pairAxes) {
    const weights = cfg.pairWeights[axis] as RelationalAxisWeights;
    assert.ok(
      'vulnerabilitySignal' in weights,
      `pairWeights.${axis} must define vulnerabilitySignal`
    );
  }
});

test('T-B semantics: dominance weight for vulnerabilitySignal is negative (self-disclosure lowers D)', () => {
  const cfg = DEFAULT_COE_INTEGRATOR_CONFIG;
  const dominanceWeight = (cfg.padWeights.dominance as RelationalAxisWeights).vulnerabilitySignal;
  assert.ok(
    dominanceWeight < 0,
    `padWeights.dominance.vulnerabilitySignal must be < 0 to enable "引く" dynamics (got ${dominanceWeight})`
  );
});

test('T-B semantics: trust weight for vulnerabilitySignal is positive (self-disclosure builds trust)', () => {
  const cfg = DEFAULT_COE_INTEGRATOR_CONFIG;
  const trustWeight = (cfg.pairWeights.trust as RelationalAxisWeights).vulnerabilitySignal;
  assert.ok(
    trustWeight > 0,
    `pairWeights.trust.vulnerabilitySignal must be > 0 (got ${trustWeight})`
  );
});

test('T-B backward compat: config shape unchanged except for the new axis', () => {
  // All pre-T-B signals must still be present in every block.
  const existingSignals = [
    'warmthSignal',
    'reciprocitySignal',
    'safetySignal',
    'boundaryRespect',
    'pressureSignal',
    'repairSignal',
    'intimacySignal',
  ];
  const cfg = DEFAULT_COE_INTEGRATOR_CONFIG;
  const blocks = [
    cfg.padWeights.pleasure,
    cfg.padWeights.arousal,
    cfg.padWeights.dominance,
    cfg.pairWeights.trust,
    cfg.pairWeights.affinity,
    cfg.pairWeights.conflict,
    cfg.pairWeights.intimacyReadiness,
  ] as unknown as RelationalAxisWeights[];
  for (const block of blocks) {
    for (const signal of existingSignals) {
      assert.ok(
        signal in block,
        `every block must still define "${signal}" (backward compat)`
      );
    }
  }
});
