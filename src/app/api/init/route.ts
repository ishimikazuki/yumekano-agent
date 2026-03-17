import { NextResponse } from 'next/server';
import { seed } from '@/lib/db/seed';

/**
 * Initialize database and seed data.
 * Call this once to set up the system.
 */
export async function POST() {
  try {
    await seed();
    return NextResponse.json({ success: true, message: 'Database initialized and seeded' });
  } catch (error) {
    console.error('Init error:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unknown error' },
      { status: 500 }
    );
  }
}
