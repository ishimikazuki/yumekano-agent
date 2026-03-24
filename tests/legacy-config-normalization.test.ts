import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeLegacyAutonomy,
  normalizeLegacyEmotion,
  normalizeLegacyStyle,
} from '@/lib/repositories/legacy-config-normalization';
import {
  AutonomySpecSchema,
  EmotionSpecSchema,
  StyleSpecSchema,
} from '@/lib/schemas';

test('legacy emotion normalization backfills missing selfRelevance for published versions', () => {
  const normalized = EmotionSpecSchema.parse(
    normalizeLegacyEmotion({
      baseline: {
        pleasure: 0.1,
        arousal: -0.1,
        dominance: 0.2,
      },
      recovery: {
        pleasureHalfLifeTurns: 6,
        arousalHalfLifeTurns: 4,
        dominanceHalfLifeTurns: 5,
      },
      appraisalSensitivity: {
        goalCongruence: 0.8,
        controllability: 0.5,
        certainty: 0.4,
        normAlignment: 0.7,
        attachmentSecurity: 0.6,
        reciprocity: 0.7,
        pressureIntrusiveness: 0.3,
        novelty: 0.2,
      },
      externalization: {
        warmthWeight: 0.9,
        tersenessWeight: 0.2,
        directnessWeight: 0.6,
        teasingWeight: 0.4,
      },
    })
  );

  assert.equal(normalized.baselinePAD.pleasure, 0.1);
  assert.equal(normalized.appraisalSensitivity.selfRelevance, 0.5);
});

test('legacy style and autonomy normalization keeps published configs schema-valid', () => {
  const style = StyleSpecSchema.parse(
    normalizeLegacyStyle({
      language: 'en',
      politenessDefault: 'formal',
      terseness: 0.3,
      directness: 0.5,
      playfulness: 0.4,
      teasing: 0.2,
      initiative: 0.5,
      emojiRate: 0.1,
      sentenceLengthBias: 'short',
      tabooPhrases: [],
      signaturePhrases: [],
    })
  );
  const autonomy = AutonomySpecSchema.parse(
    normalizeLegacyAutonomy({
      disagreementReadiness: 0.6,
      refusalReadiness: 0.4,
      delayReadiness: 0.3,
      repairReadiness: 0.5,
      conflictSustain: 0.7,
      intimacyNotOnDemand: true,
    })
  );

  assert.equal(style.language, 'ja');
  assert.equal(style.politenessDefault, 'polite');
  assert.equal(autonomy.disagreeReadiness, 0.6);
  assert.equal(autonomy.conflictCarryover, 0.7);
  assert.equal(autonomy.intimacyNeverOnDemand, true);
});
