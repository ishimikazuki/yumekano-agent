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

    // Get latest published version
    const latestPublished = await characterRepo.getLatestPublished(id);

    // Get current release
    const currentRelease = await releaseRepo.getCurrent(id, 'prod');

    // Get phase graph for latest version if exists
    let phaseGraph = null;
    if (latestPublished) {
      phaseGraph = await phaseGraphRepo.getById(latestPublished.phaseGraphVersionId);
    }

    return NextResponse.json({
      character,
      latestVersion: latestPublished,
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
