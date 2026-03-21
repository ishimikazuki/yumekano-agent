import { NextRequest, NextResponse } from 'next/server';
import { characterRepo, phaseGraphRepo, releaseRepo } from '@/lib/repositories';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const character = await characterRepo.getById(id);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    // Get all versions
    const versions = await characterRepo.listVersions(id);

    // Get current release
    const currentRelease = await releaseRepo.getCurrent(id, 'prod');

    // Prefer the live release version for dashboard display.
    const currentVersion = currentRelease
      ? await characterRepo.getVersionById(currentRelease.characterVersionId)
      : null;

    // Fall back to the latest published version when no release exists yet.
    const latestPublished = currentVersion ?? await characterRepo.getLatestPublished(id);

    // Get phase graph for latest version if exists
    let phaseGraph = null;
    if (latestPublished) {
      phaseGraph = await phaseGraphRepo.getById(latestPublished.phaseGraphVersionId);
    }

    return NextResponse.json({
      character,
      latestVersion: currentVersion
        ? { ...currentVersion, status: 'published' }
        : latestPublished,
      versions,
      currentRelease,
      phaseGraph: phaseGraph?.graph ?? null,
    });
  } catch (error) {
    console.error('Get character error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
