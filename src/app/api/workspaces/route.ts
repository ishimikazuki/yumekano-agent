import { NextRequest, NextResponse } from 'next/server';
import { workspaceRepo, characterRepo } from '@/lib/repositories';
import { z } from 'zod';

const CreateWorkspaceSchema = z.object({
  characterId: z.string().uuid(),
  name: z.string().min(1),
  createdBy: z.string().min(1),
});

/**
 * GET /api/workspaces?characterId=xxx
 * List workspaces for a character
 */
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

    const workspaces = await workspaceRepo.listByCharacter(characterId);

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('List workspaces error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Create a new workspace
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify character exists
    const character = await characterRepo.getById(parsed.data.characterId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    const workspace = await workspaceRepo.create({
      characterId: parsed.data.characterId,
      name: parsed.data.name,
      createdBy: parsed.data.createdBy,
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
