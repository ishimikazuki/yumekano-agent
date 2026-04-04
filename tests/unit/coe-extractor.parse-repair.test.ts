/**
 * T4: CoE extractor parse repair test
 *
 * Verifies malformed model output handling.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCoEEvidenceExtractorOutput } from '@/mastra/agents/coe-evidence-extractor';

test('T4 parseCoEEvidenceExtractorOutput rejects empty interactionActs', () => {
  assert.throws(
    () =>
      parseCoEEvidenceExtractorOutput({
        interactionActs: [],
        relationalAppraisal: {
          warmthImpact: 0.5, rejectionImpact: 0, respectImpact: 0.3,
          threatImpact: 0, pressureImpact: 0, repairImpact: 0,
          reciprocityImpact: 0, intimacySignal: 0, boundarySignal: 0, certainty: 0.7,
        },
        confidence: 0.8,
        uncertaintyNotes: [],
      }),
    /interactionActs/i
  );
});

test('T4 parseCoEEvidenceExtractorOutput accepts valid output', () => {
  const result = parseCoEEvidenceExtractorOutput({
    interactionActs: [
      {
        act: 'compliment',
        target: 'character',
        polarity: 'positive',
        intensity: 0.7,
        confidence: 0.85,
        evidenceSpans: [{ source: 'user_message', sourceId: null, text: 'cute', start: 0, end: 4 }],
        uncertaintyNotes: [],
      },
    ],
    relationalAppraisal: {
      warmthImpact: 0.6, rejectionImpact: 0, respectImpact: 0.4,
      threatImpact: 0, pressureImpact: 0, repairImpact: 0,
      reciprocityImpact: 0.2, intimacySignal: 0.3, boundarySignal: 0.1, certainty: 0.8,
    },
    confidence: 0.9,
    uncertaintyNotes: [],
  });
  assert.ok(result.interactionActs.length > 0);
  assert.ok(result.relationalAppraisal.warmthImpact > 0);
});
