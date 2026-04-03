import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { preparePublishedPersona } from '@/lib/persona';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

const RollbackRequestSchema = z.object({
  rolledBackBy: z.string().default('designer'),
});

/**
 * POST /api/characters/[id]/versions/[versionId]/rollback
 * Rollback to a specific version by republishing it
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: characterId, versionId: targetVersionId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      body = {};
    }
    const parsed = RollbackRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { rolledBackBy } = parsed.data;
    const db = getDb();
    const now = new Date().toISOString();

    // Get target version
    const targetResult = await db.execute({
      sql: `SELECT * FROM character_versions WHERE id = ? AND character_id = ?`,
      args: [targetVersionId, characterId],
    });

    if (targetResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const targetVersion = targetResult.rows[0];
    let parsedPersona;
    try {
      parsedPersona = JSON.parse(targetVersion.persona_json as string);
    } catch {
      return NextResponse.json(
        { error: 'Invalid persona JSON in target version' },
        { status: 500 }
      );
    }
    const preparedPersona = await preparePublishedPersona(parsedPersona);

    // Get current max version number
    const maxVersionResult = await db.execute({
      sql: 'SELECT MAX(version_number) as max_version FROM character_versions WHERE character_id = ?',
      args: [characterId],
    });
    const maxVersion = (maxVersionResult.rows[0]?.max_version as number) || 0;
    const newVersionNumber = maxVersion + 1;

    // Create new version as a copy of the target version
    const newVersionId = uuid();
    await db.execute({
      sql: `INSERT INTO character_versions
            (id, character_id, version_number, label, status, persona_json, style_json, autonomy_json, emotion_json, memory_policy_json, phase_graph_version_id, prompt_bundle_version_id, created_by, created_at, parent_version_id)
            VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVersionId,
        characterId,
        newVersionNumber,
        `ロールバック: v${targetVersion.version_number}${targetVersion.label ? ` (${targetVersion.label})` : ''}`,
        JSON.stringify(preparedPersona),
        targetVersion.style_json,
        targetVersion.autonomy_json,
        targetVersion.emotion_json,
        targetVersion.memory_policy_json,
        targetVersion.phase_graph_version_id,
        targetVersion.prompt_bundle_version_id,
        rolledBackBy,
        now,
        targetVersionId, // Parent is the version we're rolling back to
      ],
    });

    // Archive old published versions
    await db.execute({
      sql: `UPDATE character_versions SET status = 'archived' WHERE character_id = ? AND id != ? AND status = 'published'`,
      args: [characterId, newVersionId],
    });

    // Get the original release for the target version (if exists)
    const originalReleaseResult = await db.execute({
      sql: 'SELECT id FROM releases WHERE character_version_id = ? ORDER BY published_at DESC LIMIT 1',
      args: [targetVersionId],
    });

    // Create release record for rollback
    const releaseId = uuid();
    await db.execute({
      sql: `INSERT INTO releases (id, character_id, character_version_id, channel, published_by, published_at, rollback_of_release_id)
            VALUES (?, ?, ?, 'prod', ?, ?, ?)`,
      args: [
        releaseId,
        characterId,
        newVersionId,
        rolledBackBy,
        now,
        originalReleaseResult.rows[0]?.id || null,
      ],
    });

    return NextResponse.json({
      success: true,
      version: {
        id: newVersionId,
        versionNumber: newVersionNumber,
        label: `ロールバック: v${targetVersion.version_number}`,
        status: 'published',
        createdAt: now,
        parentVersionId: targetVersionId,
      },
      releaseId,
      rolledBackFromVersion: {
        id: targetVersionId,
        versionNumber: targetVersion.version_number,
        label: targetVersion.label,
      },
    });
  } catch (error) {
    console.error('Rollback error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
