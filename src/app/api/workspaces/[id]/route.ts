import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo } from '@/lib/repositories';
import { resolveInitialDraftForCharacter } from '@/lib/workspaces/initial-draft';
import {
  DraftStateSchema,
  CharacterIdentitySchema,
  PersonaAuthoringSchema,
  StyleSpecSchema,
  AutonomySpecSchema,
  EmotionSpecSchema,
  MemoryPolicySpecSchema,
  PhaseGraphSchema,
  PromptBundleContentSchema,
} from '@/lib/schemas';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]
 * Get workspace with draft state
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    let workspace = await workspaceRepo.getWithDraft(id);

    if (!workspace) {
      const workspaceMeta = await workspaceRepo.getById(id);
      if (!workspaceMeta) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        );
      }

      const initialDraft = await resolveInitialDraftForCharacter(
        workspaceMeta.characterId,
        id
      );

      if (!initialDraft) {
        return NextResponse.json(
          { error: 'Workspace draft is not initialized' },
          { status: 409 }
        );
      }

      await workspaceRepo.initDraft(id, initialDraft);
      workspace = await workspaceRepo.getWithDraft(id);
    }

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

/**
 * PUT /api/workspaces/[id]
 * Replace the full draft state.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = DraftStateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid draft payload', details: parsed.error.flatten() },
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

    const existingDraft = await workspaceRepo.getDraft(id);
    if (existingDraft) {
      await workspaceRepo.replaceDraft(id, parsed.data);
    } else {
      await workspaceRepo.initDraft(id, parsed.data);
    }

    const updated = await workspaceRepo.getDraft(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Replace draft error:', error);
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

const sectionSchemas = {
  identity: CharacterIdentitySchema,
  persona: PersonaAuthoringSchema,
  style: StyleSpecSchema,
  autonomy: AutonomySpecSchema,
  emotion: EmotionSpecSchema,
  memory: MemoryPolicySpecSchema,
  phaseGraph: PhaseGraphSchema,
  prompts: PromptBundleContentSchema,
} as const;

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

    const sectionSchema = sectionSchemas[parsed.data.section];
    const valueResult = sectionSchema.safeParse(parsed.data.value);
    if (!valueResult.success) {
      return NextResponse.json(
        {
          error: `Invalid ${parsed.data.section} payload`,
          details: valueResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Update the section
    await workspaceRepo.updateDraftSection(
      id,
      parsed.data.section as keyof z.infer<typeof DraftStateSchema>,
      valueResult.data as never
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
