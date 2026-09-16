import { NextRequest, NextResponse } from 'next/server';
import { getPublicTasks } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address') || undefined;

    const tasks = await getPublicTasks(address);
    return NextResponse.json(
      { tasks },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/tasks] Error fetching tasks, providing fallback:', error);
    try {
      const fallback = await getPublicTasks();
      return NextResponse.json(
        { tasks: fallback },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
          },
        }
      );
    } catch {
      return NextResponse.json({ tasks: [] }, { status: 200 });
    }
  }
}
