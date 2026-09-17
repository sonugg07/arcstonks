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
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Admin Waitlist GET Error]:', error.message || error);
    const isQuota = Boolean(error.message?.includes('RESOURCE_EXHAUSTED'));
    return NextResponse.json({
      users: [],
      total: 0,
      error: error.message || 'Failed to fetch waitlist users',
      isQuotaError: isQuota,
    }, { status: isQuota ? 429 : 500 });
  }
}
