import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAuthenticated = verifyAdminSession(request);
  const dbEnvKeys = isAuthenticated
    ? Object.keys(process.env).filter(k => !k.startsWith('VERCEL') && !k.startsWith('AWS') && !k.startsWith('LAMBDA') && !k.startsWith('NODE') && !k.startsWith('npm_') && !k.startsWith('_') && !k.startsWith('PATH'))
    : [];
  return NextResponse.json({
    authenticated: isAuthenticated,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    dbEnvKeys,
  });
}
