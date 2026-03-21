import { NextRequest, NextResponse } from 'next/server';
import { memoryRepo, pairRepo } from '@/lib/repositories';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: characterId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const pair = await pairRepo.getByUserAndCharacter(userId, characterId);
    if (!pair) {
      return NextResponse.json({
        pairId: null,
        userId,
        events: [],
        facts: [],
        threads: [],
        workingMemory: null,
      });
    }

    const [events, facts, threads, workingMemory] = await Promise.all([
      memoryRepo.getEventsByPair(pair.id, 50),
      memoryRepo.getFactsByPair(pair.id),
      memoryRepo.getOpenThreads(pair.id),
      memoryRepo.getWorkingMemory(pair.id),
    ]);

    return NextResponse.json({
      pairId: pair.id,
      userId,
      events,
      facts,
      threads,
      workingMemory,
    });
  } catch (error) {
    console.error('Get character memory error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
