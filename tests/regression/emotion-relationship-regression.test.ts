import assert from 'node:assert/strict';
import test from 'node:test';
import { emotionRelationshipRegressionFixtures } from '../fixtures/emotion-relationship-regression-fixtures';
import {
  collectFixtureMismatches,
  runEmotionRelationshipFixture,
} from './emotion-relationship-regression-harness';

for (const fixture of emotionRelationshipRegressionFixtures) {
  test(`emotion relationship regression: ${fixture.id}`, () => {
    const result = runEmotionRelationshipFixture(fixture);
    const mismatches = collectFixtureMismatches(fixture, result);

    assert.equal(
      mismatches.length,
      0,
      [`${fixture.title}: ${fixture.notes}`, ...mismatches].join('\n')
    );
  });
}
