import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAuthenticated = verifyAdminSession(request);
  return NextResponse.json({ authenticated: isAuthenticated });
}
