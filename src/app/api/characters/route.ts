import { NextResponse } from 'next/server';
import { characterRepo } from '@/lib/repositories';

export async function GET() {
  try {
    const characters = await characterRepo.list();
    return NextResponse.json({ characters });
  } catch (error) {
    console.error('Error fetching characters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch characters' },
      { status: 500 }
    );
  }
}
