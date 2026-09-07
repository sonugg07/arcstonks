import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const isAuthenticated = verifyAdminSession(request);
  const dbEnvKeys = isAuthenticated
    ? Object.keys(process.env).filter(k => /db|sql|postgres|database|kv|redis|turso|storage|supabase|neon|prisma/i.test(k))
    : [];
  return NextResponse.json({ authenticated: isAuthenticated, dbEnvKeys });
}
