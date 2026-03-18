import { NextRequest, NextResponse } from 'next/server';
import { runDraftChatTurn, type DraftChatTurnInput } from '@/mastra/workflows/draft-chat-turn';
import { z } from 'zod';

const DraftChatRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  userId: z.string().min(1),
  message: z.string().min(1),
  forcePhaseId: z.string().optional(),
  forcePAD: z.object({
    pleasure: z.number().min(-1).max(1),
    arousal: z.number().min(-1).max(1),
    dominance: z.number().min(-1).max(1),
  }).optional(),
});

/**
 * POST /api/draft-chat
 * Run a chat turn using draft workspace state (sandbox mode)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DraftChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input: DraftChatTurnInput = {
      workspaceId: parsed.data.workspaceId,
      sessionId: parsed.data.sessionId,
      userId: parsed.data.userId,
      message: parsed.data.message,
      forcePhaseId: parsed.data.forcePhaseId,
      forcePAD: parsed.data.forcePAD,
    };

    const result = await runDraftChatTurn(input);

    return NextResponse.json({
      text: result.text,
      sessionId: result.sessionId,
      turnId: result.turnId,
      phaseId: result.phaseId,
      emotion: result.emotion,
      trace: result.trace,
    });
  } catch (error) {
    console.error('Draft chat turn error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
