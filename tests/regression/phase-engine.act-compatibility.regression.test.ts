/**
 * T-A: phase engine backward-compat regression
 *
 * Verifies that a character whose `allowedActs` only references pre-T-A
 * dialogue acts still works unchanged — enum extensions must never force
 * existing configs to re-adopt the new acts.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { PhaseNodeSchema } from '@/lib/schemas/phase';

test('phase config using only pre-T-A acts still parses', () => {
  const legacyPhase = {
    id: 'legacy_phase',
    label: 'legacy',
    description: 'pre-T-A phase',
    mode: 'relationship' as const,
    authoredNotes: 'legacy',
    acceptanceProfile: {
      warmthFloor: 0.4,
      trustFloor: 30,
    },
    allowedActs: ['share_information', 'ask_question', 'continue_topic'],
    disallowedActs: [],
    adultIntimacyEligibility: 'never' as const,
    examplesPositive: [],
    examplesNegative: [],
  };

  const parsed = PhaseNodeSchema.safeParse(legacyPhase);
  assert.ok(
    parsed.success,
    `legacy phase must still parse. Errors: ${
      parsed.success ? '' : JSON.stringify(parsed.error.format())
    }`
  );
});

test('phase config referencing the new T-A acts also parses', () => {
  const modernPhase = {
    id: 'modern_phase',
    label: 'modern',
    description: 'post-T-A phase',
    mode: 'relationship' as const,
    authoredNotes: 'modern',
    acceptanceProfile: {},
    allowedActs: ['share_information', 'self_disclose', 'show_vulnerability'],
    disallowedActs: ['ask_question'],
    adultIntimacyEligibility: 'never' as const,
    examplesPositive: [],
    examplesNegative: [],
  };

  const parsed = PhaseNodeSchema.safeParse(modernPhase);
  assert.ok(
    parsed.success,
    `modern phase must parse. Errors: ${
      parsed.success ? '' : JSON.stringify(parsed.error.format())
    }`
  );
});

test('an unknown act is still rejected (enum still guards)', () => {
  const invalid = {
    id: 'invalid',
    label: 'invalid',
    description: 'x',
    mode: 'relationship' as const,
    authoredNotes: '',
    acceptanceProfile: {},
    allowedActs: ['total_nonsense_act'],
    disallowedActs: [],
    adultIntimacyEligibility: 'never' as const,
    examplesPositive: [],
    examplesNegative: [],
  };
  const parsed = PhaseNodeSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
});
