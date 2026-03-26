import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceRepo } from '@/lib/repositories';
import { restorePlaygroundMessages } from '@/lib/workspaces/playground-history';
import { resetDraftChatSession } from '@/mastra/workflows/draft-chat-turn';

type RouteParams = { params: Promise<{ id: string }> };

const PlaygroundSessionLookupSchema = z.object({
  sessionId: z.string().uuid().optional(),
  userId: z.string().min(1).optional(),
}).refine((value) => value.sessionId || value.userId, {
  message: 'sessionId or userId is required',
});

const PlaygroundSessionResetSchema = z.object({
  sessionId: z.string().uuid().optional(),
  userId: z.string().min(1),
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
    const parsedQuery = PlaygroundSessionLookupSchema.safeParse({
      sessionId: searchParams.get('sessionId'),
      userId: searchParams.get('userId'),
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'sessionId or userId is required', details: parsedQuery.error.flatten() },
        { status: 400 }
      );
    }

    const session = parsedQuery.data.sessionId
      ? await workspaceRepo.getSession(parsedQuery.data.sessionId)
      : await workspaceRepo.getLatestSessionForUser(id, parsedQuery.data.userId!);

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

/**
 * DELETE /api/workspaces/[id]/playground-session
 * Explicitly reset the current or latest sandbox session for this workspace/user.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const missingWorkspaceResponse = await ensureWorkspaceExists(id);
    if (missingWorkspaceResponse) return missingWorkspaceResponse;

    const body = await request.json().catch(() => ({}));
    const parsedBody = PlaygroundSessionResetSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const result = await resetDraftChatSession({
      workspaceId: id,
      userId: parsedBody.data.userId,
      sessionId: parsedBody.data.sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Delete playground session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
