import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getWaitlistUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getWaitlistUsers(search, limit, offset);
    return NextResponse.json({ ok: true, users: result.users, total: result.total });
  } catch (error: any) {
    console.error('[Admin Waitlist GET Error]:', error.message || error);
    const isQuota = Boolean(error.message?.includes('RESOURCE_EXHAUSTED'));
    return NextResponse.json({
      ok: false,
      error: isQuota ? 'FIRESTORE_QUOTA_EXCEEDED' : 'FIRESTORE_READ_FAILED',
      message: error.message || 'Failed to fetch waitlist users',
      isQuotaError: isQuota,
      users: [],
      total: null,
    }, { status: isQuota ? 429 : 500 });
  }
}
