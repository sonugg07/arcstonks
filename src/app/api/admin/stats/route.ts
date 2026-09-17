import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAdminStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const stats = await getAdminStats();
    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    console.error('[Admin Stats GET Error]:', error.message || error);
    return NextResponse.json({
      totalWaitlist: 0,
      totalEligible: 0,
      totalAllocation: 0,
      waitlistEnabled: true,
      checkerEnabled: true,
      totalTasks: 4,
      totalCompletions: 0,
      firestoreStatus: 'degraded',
      error: error.message || 'Error loading stats from Firestore',
    }, { status: 200 });
  }
}
