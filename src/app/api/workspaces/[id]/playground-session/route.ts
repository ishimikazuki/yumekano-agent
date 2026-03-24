import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceRepo } from '@/lib/repositories';
import { restorePlaygroundMessages } from '@/lib/workspaces/playground-history';

type RouteParams = { params: Promise<{ id: string }> };

const PlaygroundSessionQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * GET /api/workspaces/[id]/playground-session?sessionId=...
 * Restore persisted sandbox conversation history for this workspace.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspace = await workspaceRepo.getById(id);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = PlaygroundSessionQuerySchema.safeParse({
      sessionId: searchParams.get('sessionId'),
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'sessionId is required', details: parsedQuery.error.flatten() },
        { status: 400 }
      );
    }

    const session = await workspaceRepo.getSession(parsedQuery.data.sessionId);
    if (!session || session.workspaceId !== id) {
      return NextResponse.json(
        { error: 'Playground session not found' },
        { status: 404 }
      );
    }

    const turns = await workspaceRepo.getTurns(session.id);

    return NextResponse.json({
      sessionId: session.id,
      messages: restorePlaygroundMessages(turns),
    });
  } catch (error) {
    console.error('Get playground session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
