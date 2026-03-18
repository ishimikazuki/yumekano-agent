import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/characters/[id]/versions
 * Get version history for a character
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: characterId } = await params;
    const db = getDb();

    // Get all versions for this character, ordered by version number descending
    const result = await db.execute({
      sql: `
        SELECT
          cv.id,
          cv.version_number,
          cv.label,
          cv.status,
          cv.created_by,
          cv.created_at,
          cv.parent_version_id,
          r.published_at as release_published_at,
          r.channel as release_channel
        FROM character_versions cv
        LEFT JOIN releases r ON r.character_version_id = cv.id
        WHERE cv.character_id = ?
        ORDER BY cv.version_number DESC
      `,
      args: [characterId],
    });

    const versions = result.rows.map((row) => ({
      id: row.id as string,
      versionNumber: row.version_number as number,
      label: row.label as string | null,
      status: row.status as string,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
      parentVersionId: row.parent_version_id as string | null,
      release: row.release_published_at
        ? {
            publishedAt: row.release_published_at as string,
            channel: row.release_channel as string,
          }
        : null,
    }));

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
