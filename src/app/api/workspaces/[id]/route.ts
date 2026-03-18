import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/repositories';
import { DraftStateSchema } from '@/lib/schemas';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]
 * Get workspace with draft state
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspace = await workspaceRepo.getWithDraft(id);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Get workspace error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[id]
 * Delete a workspace
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspace = await workspaceRepo.getById(id);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    await workspaceRepo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

const UpdateDraftSectionSchema = z.object({
  section: z.enum(['identity', 'persona', 'style', 'autonomy', 'emotion', 'memory', 'phaseGraph', 'prompts']),
  value: z.unknown(),
});

/**
 * PATCH /api/workspaces/[id]
 * Update a section of the draft state
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateDraftSectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const workspace = await workspaceRepo.getById(id);
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Update the section
    await workspaceRepo.updateDraftSection(
      id,
      parsed.data.section as keyof z.infer<typeof DraftStateSchema>,
      parsed.data.value as never
    );

    // Return updated draft
    const updated = await workspaceRepo.getDraft(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update draft section error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
