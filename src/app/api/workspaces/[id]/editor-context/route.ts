import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/repositories';
import { EditorContextSchema } from '@/lib/schemas';

type RouteParams = { params: Promise<{ id: string }> };

async function ensureWorkspaceExists(workspaceId: string) {
  const workspace = await workspaceRepo.getById(workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404 }
    );
  }

  return null;
}

/**
 * GET /api/workspaces/[id]/editor-context
 * Load persisted editor context for this workspace.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const missingWorkspaceResponse = await ensureWorkspaceExists(id);
    if (missingWorkspaceResponse) return missingWorkspaceResponse;

    const context = await workspaceRepo.getEditorContext(id);
    return NextResponse.json(context ?? {});
  } catch (error) {
    console.error('Get editor context error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/[id]/editor-context
 * Replace persisted editor context for this workspace.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const missingWorkspaceResponse = await ensureWorkspaceExists(id);
    if (missingWorkspaceResponse) return missingWorkspaceResponse;

    const body = await request.json();
    const parsed = EditorContextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await workspaceRepo.saveEditorContext(id, parsed.data);
    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('Save editor context error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
