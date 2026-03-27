import { NextRequest, NextResponse } from 'next/server';
import { publishWorkspaceDraft } from '@/lib/versioning/publish';
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

    const result = await publishWorkspaceDraft({
      workspaceId,
      label,
      publishedBy,
      activateImmediately: true,
    });

    return NextResponse.json({
      success: true,
      version: {
        id: result.versionId,
        versionNumber: result.versionNumber,
        label,
        status: 'published',
        createdAt: result.createdAt?.toISOString(),
      },
      releaseId: result.releaseId,
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
