import { NextRequest, NextResponse } from 'next/server';
import { releaseRepo, characterRepo } from '@/lib/repositories';
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

    // Create rollback release
    const rollbackRelease = await releaseRepo.createRollback({
      characterId: targetRelease.characterId,
      characterVersionId: targetRelease.characterVersionId,
      publishedBy: rolledBackBy,
      rollbackOfReleaseId: targetReleaseId,
    });

    return NextResponse.json({
      release: rollbackRelease,
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
