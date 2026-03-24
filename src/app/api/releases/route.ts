import { NextRequest, NextResponse } from 'next/server';
import { releaseRepo, characterRepo } from '@/lib/repositories';
import { getDb } from '@/lib/db/client';
import { preparePublishedPersona } from '@/lib/persona';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

const PublishRequestSchema = z.object({
  characterVersionId: z.string().uuid(),
  publishedBy: z.string().min(1),
});

const RollbackRequestSchema = z.object({
  targetReleaseId: z.string().uuid(),
  rolledBackBy: z.string().min(1),
});

// GET /api/releases?characterId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');

    if (!characterId) {
      return NextResponse.json(
        { error: 'characterId is required' },
        { status: 400 }
      );
    }

    const releases = await releaseRepo.listByCharacter(characterId);
    const currentRelease = await releaseRepo.getCurrent(characterId, 'prod');

    return NextResponse.json({
      releases,
      currentRelease,
    });
  } catch (error) {
    console.error('Get releases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/releases - Publish new release
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PublishRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { characterVersionId, publishedBy } = parsed.data;

    // Validate version exists and is published status
    const version = await characterRepo.getVersionById(characterVersionId);
    if (!version) {
      return NextResponse.json(
        { error: 'Character version not found' },
        { status: 404 }
      );
    }

    const preparedPersona = await preparePublishedPersona(version.persona);
    if (JSON.stringify(preparedPersona) !== JSON.stringify(version.persona)) {
      await characterRepo.updateVersionPersona(characterVersionId, preparedPersona);
    }

    // Update version status to published if draft
    if (version.status === 'draft') {
      await characterRepo.updateVersionStatus(characterVersionId, 'published');
    }

    // Create release
    const release = await releaseRepo.create({
      characterId: version.characterId,
      characterVersionId,
      publishedBy,
    });

    return NextResponse.json({
      release,
      status: 'published',
    });
  } catch (error) {
    console.error('Publish release error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/releases - Rollback
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RollbackRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetReleaseId, rolledBackBy } = parsed.data;

    // Get target release
    const targetRelease = await releaseRepo.getById(targetReleaseId);
    if (!targetRelease) {
      return NextResponse.json(
        { error: 'Target release not found' },
        { status: 404 }
      );
    }

    const targetVersion = await characterRepo.getVersionById(targetRelease.characterVersionId);
    if (!targetVersion) {
      return NextResponse.json(
        { error: 'Target version not found' },
        { status: 404 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    const preparedPersona = await preparePublishedPersona(targetVersion.persona);

    const maxVersionResult = await db.execute({
      sql: 'SELECT COALESCE(MAX(version_number), 0) as max_version FROM character_versions WHERE character_id = ?',
      args: [targetRelease.characterId],
    });
    const maxVersion = Number(maxVersionResult.rows[0]?.max_version ?? 0);
    const newVersionNumber = maxVersion + 1;
    const newVersionId = uuid();
    const rollbackLabel = `ロールバック: v${targetVersion.versionNumber}${
      targetVersion.label ? ` (${targetVersion.label})` : ''
    }`;

    await db.execute({
      sql: `INSERT INTO character_versions
            (id, character_id, version_number, label, status, persona_json, style_json, autonomy_json, emotion_json, memory_policy_json, phase_graph_version_id, prompt_bundle_version_id, created_by, created_at, parent_version_id)
            VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVersionId,
        targetRelease.characterId,
        newVersionNumber,
        rollbackLabel,
        JSON.stringify(preparedPersona),
        JSON.stringify(targetVersion.style),
        JSON.stringify(targetVersion.autonomy),
        JSON.stringify(targetVersion.emotion),
        JSON.stringify(targetVersion.memory),
        targetVersion.phaseGraphVersionId,
        targetVersion.promptBundleVersionId,
        rolledBackBy,
        now,
        targetVersion.id,
      ],
    });

    await db.execute({
      sql: `UPDATE character_versions
            SET status = 'archived'
            WHERE character_id = ? AND id != ? AND status = 'published'`,
      args: [targetRelease.characterId, newVersionId],
    });

    const rollbackRelease = await releaseRepo.createRollback({
      characterId: targetRelease.characterId,
      characterVersionId: newVersionId,
      publishedBy: rolledBackBy,
      rollbackOfReleaseId: targetReleaseId,
    });

    return NextResponse.json({
      release: rollbackRelease,
      version: {
        id: newVersionId,
        versionNumber: newVersionNumber,
        label: rollbackLabel,
        status: 'published',
        parentVersionId: targetVersion.id,
      },
      status: 'rolled_back',
    });
  } catch (error) {
    console.error('Rollback release error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
