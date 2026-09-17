import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAdminStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const stats = await getAdminStats();

    if (stats.ok === false || stats.firestoreStatus === 'quota_exceeded' || stats.firestoreStatus === 'error') {
      const status = stats.isQuotaError ? 429 : 503;
      return NextResponse.json(stats, { status });
    }

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    console.error('[Admin Stats GET Error]:', error.message || error);
    const isQuota = Boolean(error.message?.includes('RESOURCE_EXHAUSTED'));
    return NextResponse.json({
      ok: false,
      totalWaitlist: null,
      totalEligible: null,
      totalAllocation: null,
      waitlistEnabled: true,
      checkerEnabled: true,
      totalTasks: null,
      totalCompletions: null,
      firestoreStatus: isQuota ? 'quota_exceeded' : 'error',
      isQuotaError: isQuota,
      error: error.message || 'Error loading stats from Firestore',
    }, { status: isQuota ? 429 : 503 });
  }
}
