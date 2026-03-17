import { NextRequest, NextResponse } from 'next/server';
import { traceRepo } from '@/lib/repositories';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const trace = await traceRepo.getTraceById(id);
    if (!trace) {
      return NextResponse.json(
        { error: 'Trace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trace });
  } catch (error) {
    console.error('Get trace error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
