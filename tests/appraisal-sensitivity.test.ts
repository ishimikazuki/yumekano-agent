import assert from 'node:assert/strict';
import test from 'node:test';
import { computeAppraisal } from '@/lib/rules/appraisal';
import { updatePAD } from '@/lib/rules/pad';
import { createSeiraDraftState } from '@/lib/db/seed-seira';
import {
  createCharacterVersion,
  createPairState,
  createWorkingMemory,
} from './persona-test-helpers';

test('neutral bounded appraisals stay centered when sensitivity is below 1', () => {
  const characterVersion = createCharacterVersion({
    emotion: {
      ...createCharacterVersion().emotion,
      appraisalSensitivity: {
        ...createCharacterVersion().emotion.appraisalSensitivity,
        controllability: 0.2,
        certainty: 0.3,
        attachmentSecurity: 0.4,
        novelty: 0.1,
      },
    },
  });

  const appraisal = computeAppraisal({
    userMessage: 'こんにちは',
    characterVersion,
    pairState: createPairState({
      trust: 50,
      affinity: 50,
      conflict: 0,
      intimacyReadiness: 0,
      appraisal: {
        goalCongruence: 0,
        controllability: 0.5,
        certainty: 0.5,
        normAlignment: 0,
        attachmentSecurity: 0.5,
        reciprocity: 0,
        pressureIntrusiveness: 0,
        novelty: 0.5,
        selfRelevance: 0.5,
      },
      openThreadCount: 0,
    }),
    workingMemory: {
      ...createWorkingMemory(),
      knownCorrections: [],
      knownLikes: [],
      knownDislikes: [],
      activeTensionSummary: null,
    },
    openThreads: [],
    recentDialogue: [],
  });

  assert.equal(appraisal.controllability, 0.5);
  assert.equal(appraisal.certainty, 0.5);
  assert.equal(appraisal.attachmentSecurity, 0.5);
  assert.equal(appraisal.novelty, 0.5);
});

test('returning a dropped item reads as helpful instead of lowering seira PAD', () => {
  const draft = createSeiraDraftState();
  const characterVersion = createCharacterVersion({
    style: draft.style,
    emotion: draft.emotion,
  });
  const pairState = createPairState({
    activePhaseId: 'station_meeting',
    affinity: 50,
    trust: 50,
    conflict: 0,
    intimacyReadiness: 0,
    pad: draft.emotion.baselinePAD,
    appraisal: {
      goalCongruence: 0,
      controllability: 0.5,
      certainty: 0.5,
      normAlignment: 0,
      attachmentSecurity: 0.5,
      reciprocity: 0,
      pressureIntrusiveness: 0,
      novelty: 0.5,
      selfRelevance: 0.5,
    },
    openThreadCount: 0,
  });

  const appraisal = computeAppraisal({
    userMessage: 'これ落としたよ',
    characterVersion,
    pairState,
    workingMemory: {
      ...createWorkingMemory(),
      knownCorrections: [],
      knownLikes: [],
      knownDislikes: [],
      activeTensionSummary: null,
    },
    openThreads: [],
    recentDialogue: [],
  });

  const updated = updatePAD({
    currentPAD: draft.emotion.baselinePAD,
    appraisal,
    emotionSpec: draft.emotion,
    hasOpenThreads: false,
    turnsSinceLastUpdate: 1,
  });

  assert.ok(appraisal.goalCongruence > 0);
  assert.ok(updated.combined.pleasure >= draft.emotion.baselinePAD.pleasure);
  assert.ok(updated.combined.dominance >= draft.emotion.baselinePAD.dominance);
});
