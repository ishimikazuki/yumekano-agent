import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { createSeiraDraftState } from '@/lib/db/seed-seira';
import { preparePublishedPersona } from '@/lib/persona';
import {
  characterRepo,
  phaseGraphRepo,
  promptBundleRepo,
  releaseRepo,
  workspaceRepo,
} from '@/lib/repositories';
import { publishWorkspaceDraft } from '@/lib/versioning/publish';

async function setupMigratedDb() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t7-'));
  const dbPath = path.join(tempDir, 't7.db');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLocalDatabaseUrl = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();
  await runMigrations();

  const cleanup = async () => {
    await getDb().close();

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousLocalDatabaseUrl === undefined) {
      delete process.env.LOCAL_DATABASE_URL;
    } else {
      process.env.LOCAL_DATABASE_URL = previousLocalDatabaseUrl;
    }

    rmSync(tempDir, { recursive: true, force: true });
  };

  return { cleanup };
}

test('Task T7 fresh database migrations keep workspace draft repositories aligned with the canonical publish model', async () => {
  const { cleanup } = await setupMigratedDb();

  try {
    const character = await characterRepo.create({
      slug: 'seira-t7-workspace',
      displayName: '蒼井セイラ',
    });
    const workspace = await workspaceRepo.create({
      characterId: character.id,
      name: 'Canonical Draft',
      createdBy: 'tester',
    });

    const draft = createSeiraDraftState();
    draft.prompts.generatorIntimacyMd = 'T7 INTIMACY PROMPT';
    draft.prompts.emotionAppraiserMd = 'T7 EMOTION APPRAISER PROMPT';
    await workspaceRepo.initDraft(workspace.id, draft);

    const loaded = await workspaceRepo.getWithDraft(workspace.id);
    assert.ok(loaded);
    assert.equal(loaded?.draft.identity.displayName, '蒼井セイラ');
    assert.equal(loaded?.draft.prompts.generatorIntimacyMd, 'T7 INTIMACY PROMPT');
    assert.equal(
      loaded?.draft.prompts.emotionAppraiserMd,
      'T7 EMOTION APPRAISER PROMPT'
    );
    assert.ok(loaded?.draft.phaseGraph.nodes.length);
    assert.equal(loaded?.draft.baseVersionId, null);
  } finally {
    await cleanup();
  }
});

test('Task T7 canonical workspace publish persists prompt bundle, phase graph, release, and workspace base-version updates through one flow', async () => {
  const { cleanup } = await setupMigratedDb();

  try {
    const character = await characterRepo.create({
      slug: 'seira-t7-publish',
      displayName: '蒼井セイラ',
    });
    const baseDraft = createSeiraDraftState();
    const basePromptBundle = await promptBundleRepo.create({
      characterId: character.id,
      prompts: baseDraft.prompts,
    });
    const basePhaseGraph = await phaseGraphRepo.create({
      characterId: character.id,
      graph: baseDraft.phaseGraph,
    });
    const baseVersion = await characterRepo.createVersion({
      characterId: character.id,
      persona: await preparePublishedPersona(baseDraft.persona),
      style: baseDraft.style,
      autonomy: baseDraft.autonomy,
      emotion: baseDraft.emotion,
      memory: baseDraft.memory,
      phaseGraphVersionId: basePhaseGraph.id,
      promptBundleVersionId: basePromptBundle.id,
      createdBy: 'tester',
      status: 'published',
      label: 'base-version',
    });

    const workspace = await workspaceRepo.create({
      characterId: character.id,
      name: 'Canonical Publish',
      createdBy: 'tester',
    });

    const draft = createSeiraDraftState();
    draft.identity.displayName = '蒼井セイラ 改';
    draft.baseVersionId = baseVersion.id;
    draft.phaseGraph.nodes[0] = {
      ...draft.phaseGraph.nodes[0]!,
      label: 'T7 Publish Phase',
    };
    draft.prompts.generatorIntimacyMd = 'T7 UPDATED INTIMACY';
    draft.prompts.emotionAppraiserMd = 'T7 UPDATED EMOTION APPRAISER';
    draft.prompts.plannerMd = `${draft.prompts.plannerMd}\n# T7`;
    await workspaceRepo.initDraft(workspace.id, draft);

    const result = await publishWorkspaceDraft({
      workspaceId: workspace.id,
      label: 't7-published',
      publishedBy: 'tester',
    });

    assert.ok(result.releaseId);

    const publishedVersion = await characterRepo.getVersionById(result.versionId);
    const archivedBaseVersion = await characterRepo.getVersionById(baseVersion.id);
    const publishedPhaseGraph = publishedVersion
      ? await phaseGraphRepo.getById(publishedVersion.phaseGraphVersionId)
      : null;
    const publishedPromptBundle = publishedVersion
      ? await promptBundleRepo.getById(publishedVersion.promptBundleVersionId)
      : null;
    const currentRelease = await releaseRepo.getCurrent(character.id);
    const updatedDraft = await workspaceRepo.getDraft(workspace.id);
    const updatedCharacter = await characterRepo.getById(character.id);

    assert.ok(publishedVersion);
    assert.equal(publishedVersion?.status, 'published');
    assert.equal(publishedVersion?.label, 't7-published');
    assert.equal(publishedVersion?.parentVersionId, baseVersion.id);
    assert.notEqual(publishedVersion?.phaseGraphVersionId, baseVersion.phaseGraphVersionId);
    assert.notEqual(
      publishedVersion?.promptBundleVersionId,
      baseVersion.promptBundleVersionId
    );

    assert.ok(publishedPhaseGraph);
    assert.equal(publishedPhaseGraph?.graph.nodes[0]?.label, 'T7 Publish Phase');

    assert.ok(publishedPromptBundle);
    assert.equal(publishedPromptBundle?.generatorIntimacyMd, 'T7 UPDATED INTIMACY');
    assert.equal(
      publishedPromptBundle?.emotionAppraiserMd,
      'T7 UPDATED EMOTION APPRAISER'
    );
    assert.match(publishedPromptBundle?.plannerMd ?? '', /# T7/);

    assert.equal(archivedBaseVersion?.status, 'archived');
    assert.equal(currentRelease?.characterVersionId, result.versionId);
    assert.equal(updatedDraft?.baseVersionId, result.versionId);
    assert.equal(updatedCharacter?.displayName, '蒼井セイラ 改');
  } finally {
    await cleanup();
  }
});
