import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { validateAdminPassword, signAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const AUTHORIZED_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sonu9888123@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase());

const PROJECT_ID =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'arcstonks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, password } = body;

    // 1. Firebase Authentication with ID Token
    if (idToken && typeof idToken === 'string') {
      try {
        const decoded: any = jwt.decode(idToken);
        if (!decoded || typeof decoded !== 'object') {
          return NextResponse.json({ error: 'Malformed Firebase Auth token.' }, { status: 400 });
        }

        const userEmail = (decoded.email || '').toLowerCase();
        const isAuthorizedEmail = AUTHORIZED_ADMIN_EMAILS.includes(userEmail);
        const hasAdminClaim = decoded.admin === true;

        if (!isAuthorizedEmail && !hasAdminClaim) {
          return NextResponse.json(
            { error: `Access Denied: ${userEmail || 'User'} is not authorized. Only sonu9888123@gmail.com has admin access.` },
            { status: 403 }
          );
        }

        // Check token expiry
        const nowSec = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp <= nowSec) {
          return NextResponse.json({ error: 'Firebase Auth token has expired. Please log in again.' }, { status: 401 });
        }

        // Issue response and set cookie
        const response = NextResponse.json({
          success: true,
          token: idToken,
          email: decoded.email,
          authType: 'firebase',
          message: `Authenticated as ${decoded.email}`,
        });

        response.cookies.set({
          name: ADMIN_COOKIE_NAME,
          value: idToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });

        return response;
      } catch (err: any) {
        return NextResponse.json({ error: 'Failed to verify Firebase token: ' + err.message }, { status: 401 });
      }
    }

    // 2. Fallback Master Password Authentication
    if (password && typeof password === 'string') {
      if (!validateAdminPassword(password)) {
        return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 });
      }

      const token = signAdminToken();
      const response = NextResponse.json({
        success: true,
        token,
        email: 'sonu9888123@gmail.com',
        authType: 'password',
        message: 'Authenticated successfully with admin credentials',
      });

      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    return NextResponse.json({ error: 'Missing authentication credentials (idToken or password).' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
