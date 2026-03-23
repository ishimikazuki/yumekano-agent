import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { workspaceRepo } from '@/lib/repositories';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const PublishRequestSchema = z.object({
  label: z.string().min(1).max(100).describe('Version label (e.g., "口癖調整版")'),
  publishedBy: z.string().default('designer'),
});

/**
 * POST /api/workspaces/[id]/publish
 * Publish workspace draft as a new character version
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: workspaceId } = await params;
    const body = await request.json();
    const parsed = PublishRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { label, publishedBy } = parsed.data;

    // Get workspace with draft
    const workspace = await workspaceRepo.getWithDraft(workspaceId);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const { draft, characterId } = workspace;
    const db = getDb();
    const now = new Date().toISOString();

    // Get current max version number
    const maxVersionResult = await db.execute({
      sql: 'SELECT MAX(version_number) as max_version FROM character_versions WHERE character_id = ?',
      args: [characterId],
    });
    const maxVersion = (maxVersionResult.rows[0]?.max_version as number) || 0;
    const newVersionNumber = maxVersion + 1;

    // Create phase graph version
    const phaseGraphVersionId = uuid();
    const phaseGraphVersionResult = await db.execute({
      sql: 'SELECT MAX(version_number) as max_version FROM phase_graph_versions WHERE character_id = ?',
      args: [characterId],
    });
    const maxPhaseVersion = (phaseGraphVersionResult.rows[0]?.max_version as number) || 0;

    await db.execute({
      sql: `INSERT INTO phase_graph_versions (id, character_id, version_number, graph_json, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [phaseGraphVersionId, characterId, maxPhaseVersion + 1, JSON.stringify(draft.phaseGraph), now],
    });

    // Create prompt bundle version
    const promptBundleVersionId = uuid();
    const promptVersionResult = await db.execute({
      sql: 'SELECT MAX(version_number) as max_version FROM prompt_bundle_versions WHERE character_id = ?',
      args: [characterId],
    });
    const maxPromptVersion = (promptVersionResult.rows[0]?.max_version as number) || 0;

    await db.execute({
      sql: `INSERT INTO prompt_bundle_versions (id, character_id, version_number, planner_md, generator_md, generator_intimacy_md, extractor_md, reflector_md, ranker_md, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        promptBundleVersionId,
        characterId,
        maxPromptVersion + 1,
        draft.prompts.plannerMd,
        draft.prompts.generatorMd,
        draft.prompts.generatorIntimacyMd,
        draft.prompts.extractorMd,
        draft.prompts.reflectorMd,
        draft.prompts.rankerMd,
        now,
      ],
    });

    // Create new character version
    const newVersionId = uuid();
    await db.execute({
      sql: `INSERT INTO character_versions
            (id, character_id, version_number, label, status, persona_json, style_json, autonomy_json, emotion_json, memory_policy_json, phase_graph_version_id, prompt_bundle_version_id, created_by, created_at, parent_version_id)
            VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVersionId,
        characterId,
        newVersionNumber,
        label,
        JSON.stringify(draft.persona),
        JSON.stringify(draft.style),
        JSON.stringify(draft.autonomy),
        JSON.stringify(draft.emotion),
        JSON.stringify(draft.memory),
        phaseGraphVersionId,
        promptBundleVersionId,
        publishedBy,
        now,
        draft.baseVersionId,
      ],
    });

    // Archive old published versions
    await db.execute({
      sql: `UPDATE character_versions SET status = 'archived' WHERE character_id = ? AND id != ? AND status = 'published'`,
      args: [characterId, newVersionId],
    });

    // Create release record
    const releaseId = uuid();
    await db.execute({
      sql: `INSERT INTO releases (id, character_id, character_version_id, channel, published_by, published_at)
            VALUES (?, ?, ?, 'prod', ?, ?)`,
      args: [releaseId, characterId, newVersionId, publishedBy, now],
    });

    // Update workspace base version
    await workspaceRepo.updateDraftSection(workspaceId, 'baseVersionId', newVersionId);

    // Update character display name if changed
    await db.execute({
      sql: 'UPDATE characters SET display_name = ? WHERE id = ?',
      args: [draft.identity.displayName, characterId],
    });

    return NextResponse.json({
      success: true,
      version: {
        id: newVersionId,
        versionNumber: newVersionNumber,
        label,
        status: 'published',
        createdAt: now,
      },
      releaseId,
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
