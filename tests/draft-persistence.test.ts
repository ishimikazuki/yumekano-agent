import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePersonaAuthoring } from '@/lib/persona';
import { createSeiraDraftState } from '@/lib/db/seed-seira';
import { serializeDraftStateForStorage } from '@/lib/workspaces/draft-persistence';

test('serializeDraftStateForStorage preserves full-draft autosave fields', () => {
  const draft = createSeiraDraftState();
  draft.baseVersionId = '11111111-1111-4111-8111-111111111111';

  const serialized = serializeDraftStateForStorage(draft);

  assert.deepStrictEqual(
    JSON.parse(serialized.personaJson),
    normalizePersonaAuthoring(draft.persona)
  );
  assert.deepStrictEqual(JSON.parse(serialized.identityJson), draft.identity);
  assert.deepStrictEqual(JSON.parse(serialized.phaseGraphJson), draft.phaseGraph);
  assert.equal(serialized.generatorIntimacyMd, draft.prompts.generatorIntimacyMd);
  assert.equal(serialized.rankerMd, draft.prompts.rankerMd);
  assert.equal(serialized.baseVersionId, draft.baseVersionId);
});
