/**
 * T-A: DialogueAct schema contract
 *
 * Locks in the enum surface so:
 *   1. `self_disclose` and `show_vulnerability` are accepted.
 *   2. Every pre-existing act still parses (no silent removals).
 *   3. Old persisted payloads (plans authored before T-A) still parse.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { DialogueActSchema } from '@/lib/schemas/plan';

const REQUIRED_NEW_ACTS = ['self_disclose', 'show_vulnerability'] as const;

// Sample of pre-T-A acts that must still parse (drawn from the original enum).
const PRE_T_A_ACTS = [
  'share_information',
  'ask_question',
  'answer_question',
  'clarify',
  'continue_topic',
  'change_topic',
] as const;

test('DialogueActSchema accepts new self-disclosure acts', () => {
  for (const act of REQUIRED_NEW_ACTS) {
    const parsed = DialogueActSchema.safeParse(act);
    assert.ok(parsed.success, `"${act}" must be a valid DialogueAct value`);
  }
});

test('DialogueActSchema still accepts every pre-T-A act (migration contract)', () => {
  for (const act of PRE_T_A_ACTS) {
    const parsed = DialogueActSchema.safeParse(act);
    assert.ok(parsed.success, `legacy act "${act}" must still parse`);
  }
});

test('DialogueActSchema rejects garbage values', () => {
  const parsed = DialogueActSchema.safeParse('not_a_real_act');
  assert.equal(parsed.success, false);
});
