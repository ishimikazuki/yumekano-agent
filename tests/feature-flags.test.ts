import assert from 'node:assert/strict';
import test from 'node:test';
import { isCoEIntegratorEnabled } from '@/lib/feature-flags';

test('isCoEIntegratorEnabled accepts explicit truthy toggles', () => {
  assert.equal(isCoEIntegratorEnabled({ YUMEKANO_USE_COE_INTEGRATOR: 'true' }), true);
  assert.equal(isCoEIntegratorEnabled({ YUMEKANO_USE_COE_INTEGRATOR: '1' }), true);
  assert.equal(isCoEIntegratorEnabled({ YUMEKANO_USE_COE_INTEGRATOR: ' On ' }), true);
});

test('isCoEIntegratorEnabled defaults to false for missing or falsy values', () => {
  assert.equal(isCoEIntegratorEnabled({}), false);
  assert.equal(isCoEIntegratorEnabled({ YUMEKANO_USE_COE_INTEGRATOR: 'false' }), false);
  assert.equal(isCoEIntegratorEnabled({ YUMEKANO_USE_COE_INTEGRATOR: '0' }), false);
});
