import { NextRequest, NextResponse } from 'next/server';
import { validateAdminPassword, signAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!validateAdminPassword(password)) {
      return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 });
    }

    const token = signAdminToken();
    const response = NextResponse.json({ success: true, message: 'Authenticated successfully' });

    // Set HTTP-only secure cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
