import { NextRequest, NextResponse } from 'next/server';
import { runChatTurn, type ChatTurnInput } from '@/mastra/workflows/chat-turn';
import { z } from 'zod';


const ChatRequestSchema = z.object({
  userId: z.string().min(1),
  characterId: z.string().uuid(),
  message: z.string().min(1),
  threadId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input: ChatTurnInput = {
      userId: parsed.data.userId,
      characterId: parsed.data.characterId,
      message: parsed.data.message,
      threadId: parsed.data.threadId,
    };

    const result = await runChatTurn(input);

    return NextResponse.json({
      text: result.text,
      traceId: result.traceId,
      phaseId: result.phaseId,
      emotion: result.emotion,
      coe: result.coe,
    });
  } catch (error) {
    console.error('Chat turn error:', error);

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
