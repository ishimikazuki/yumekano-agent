import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { createSeiraDraftState } from '@/lib/db/seed-seira';
import { promptBundleRepo, workspaceRepo } from '@/lib/repositories';
import {
  buildPromptBundleContent,
  buildPromptBundleVersion,
  PromptBundleRefSchema,
} from '@/lib/schemas';

async function setupPromptBundleDb() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-prompt-bundle-'));
  const dbPath = path.join(tempDir, 'prompt-bundle.db');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLocalDatabaseUrl = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

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

  const db = getDb();
  const statements = [
    `CREATE TABLE characters (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE character_workspaces (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id),
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE workspace_draft_state (
      workspace_id TEXT PRIMARY KEY REFERENCES character_workspaces(id),
      identity_json TEXT NOT NULL,
      persona_json TEXT NOT NULL,
      style_json TEXT NOT NULL,
      autonomy_json TEXT NOT NULL,
      emotion_json TEXT NOT NULL,
      memory_policy_json TEXT NOT NULL,
      phase_graph_json TEXT NOT NULL,
      planner_md TEXT NOT NULL,
      generator_md TEXT NOT NULL,
      generator_intimacy_md TEXT NOT NULL DEFAULT '',
      emotion_appraiser_md TEXT NOT NULL DEFAULT '',
      extractor_md TEXT NOT NULL,
      reflector_md TEXT NOT NULL,
      ranker_md TEXT NOT NULL,
      base_version_id TEXT,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE prompt_bundle_versions (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id),
      version_number INTEGER NOT NULL,
      planner_md TEXT NOT NULL,
      generator_md TEXT NOT NULL,
      generator_intimacy_md TEXT NOT NULL DEFAULT '',
      emotion_appraiser_md TEXT NOT NULL DEFAULT '',
      extractor_md TEXT NOT NULL,
      reflector_md TEXT NOT NULL,
      ranker_md TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ];

  for (const statement of statements) {
    await db.execute(statement);
  }

  await db.execute({
    sql: `INSERT INTO characters (id, slug, display_name) VALUES (?, ?, ?)`,
    args: [
      '22222222-2222-4222-8222-222222222222',
      'seira-test',
      '蒼井セイラ',
    ],
  });

  return { cleanup };
}

test('workspace draft prompt bundle round-trips the canonical prompt fields', async () => {
  const { cleanup } = await setupPromptBundleDb();

  try {
    const workspace = await workspaceRepo.create({
      characterId: '22222222-2222-4222-8222-222222222222',
      name: 'Prompt Draft',
      createdBy: 'tester',
    });

    const draft = createSeiraDraftState();
    draft.prompts = buildPromptBundleContent({
      ...draft.prompts,
      generatorIntimacyMd: 'INTIMACY PROMPT',
      emotionAppraiserMd: 'EMOTION APPRAISER PROMPT',
    });

    await workspaceRepo.initDraft(workspace.id, draft);
    const loaded = await workspaceRepo.getDraft(workspace.id);

    assert.ok(loaded);
    assert.deepStrictEqual(loaded?.prompts, draft.prompts);
  } finally {
    await cleanup();
  }
});

test('prompt bundle repo round-trips canonical prompts and backfills legacy rows', async () => {
  const { cleanup } = await setupPromptBundleDb();

  try {
    const db = getDb();
    const legacyId = '11111111-1111-4111-8111-111111111111';
    const now = '2026-03-26T00:00:00.000Z';

    await db.execute({
      sql: `INSERT INTO prompt_bundle_versions
            (id, character_id, version_number, planner_md, generator_md, generator_intimacy_md, extractor_md, reflector_md, ranker_md, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        legacyId,
        '22222222-2222-4222-8222-222222222222',
        1,
        'legacy planner',
        'legacy generator',
        'legacy intimacy',
        'legacy extractor',
        'legacy reflector',
        'legacy ranker',
        now,
      ],
    });

    const created = await promptBundleRepo.create({
      characterId: '22222222-2222-4222-8222-222222222222',
      prompts: {
        plannerMd: 'planner',
        generatorMd: 'generator',
        generatorIntimacyMd: 'intimacy',
        emotionAppraiserMd: 'emotion-appraiser',
        extractorMd: 'extractor',
        reflectorMd: 'reflector',
        rankerMd: 'ranker',
      },
    });

    const loaded = await promptBundleRepo.getById(created.id);
    const legacy = await promptBundleRepo.getById(legacyId);

    assert.ok(loaded);
    assert.equal(loaded?.generatorIntimacyMd, 'intimacy');
    assert.equal(loaded?.emotionAppraiserMd, 'emotion-appraiser');

    assert.ok(legacy);
    assert.equal(legacy?.generatorIntimacyMd, 'legacy intimacy');
    assert.equal(legacy?.emotionAppraiserMd, '');
  } finally {
    await cleanup();
  }
});

test('workspace prompt editing accepts canonical prompt keys and runtime loading preserves the canonical bundle shape', async () => {
  const { cleanup } = await setupPromptBundleDb();

  try {
    const workspace = await workspaceRepo.create({
      characterId: '22222222-2222-4222-8222-222222222222',
      name: 'Prompt Editing',
      createdBy: 'tester',
    });

    await workspaceRepo.initDraft(workspace.id, createSeiraDraftState());
    await workspaceRepo.updatePrompt(
      workspace.id,
      'generatorIntimacyMd' as never,
      'UPDATED INTIMACY PROMPT'
    );
    await workspaceRepo.updatePrompt(
      workspace.id,
      'emotionAppraiserMd' as never,
      'UPDATED EMOTION APPRAISER PROMPT'
    );

    const loaded = await workspaceRepo.getDraft(workspace.id);
    assert.ok(loaded);
    assert.equal(loaded?.prompts.generatorIntimacyMd, 'UPDATED INTIMACY PROMPT');
    assert.equal(
      loaded?.prompts.emotionAppraiserMd,
      'UPDATED EMOTION APPRAISER PROMPT'
    );

    const runtimeBundle = buildPromptBundleVersion({
      id: workspace.id,
      characterId: workspace.characterId,
      versionNumber: 1,
      createdAt: workspace.updatedAt,
      prompts: loaded?.prompts ?? {},
    });
    assert.equal(runtimeBundle.generatorIntimacyMd, 'UPDATED INTIMACY PROMPT');
    assert.equal(
      runtimeBundle.emotionAppraiserMd,
      'UPDATED EMOTION APPRAISER PROMPT'
    );
  } finally {
    await cleanup();
  }
});

test('prompt bundle ref schema keeps generator intimacy and CoE appraiser variants in the canonical shape', () => {
  const ref = PromptBundleRefSchema.parse({
    promptBundleVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    generatorIntimacyVariant: 'intimacy-v2',
    emotionAppraiserVariant: 'coe-v2',
  });

  assert.equal((ref as any).generatorIntimacyVariant, 'intimacy-v2');
  assert.equal(ref.emotionAppraiserVariant, 'coe-v2');
});
