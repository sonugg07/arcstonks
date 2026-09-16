import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'arcstonks_super_secret_jwt_key_999444';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'arcstonks@9888';
export const ADMIN_COOKIE_NAME = 'arcstonks_admin_token';

export interface AdminJwtPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

/**
 * Validates the plain text admin password
 */
export function validateAdminPassword(password: string): boolean {
  if (!password) return false;
  return password === ADMIN_PASSWORD;
}

/**
 * Generates an admin JWT token (valid for 7 days)
 */
export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Validates an individual token string (Firebase Auth ID token or ArcStonks Admin JWT)
 */
export function validateAdminToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  if (!cleanToken) return false;

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'arcstonks';

  const adminEmails = (process.env.ADMIN_EMAILS || 'sonu9888123@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase());

  // 1. Try validating as ArcStonks Admin JWT (signed with server secret)
  try {
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as AdminJwtPayload;
    if (decoded && decoded.role === 'admin') {
      return true;
    }
  } catch {}

  // 2. Try validating as Firebase Auth ID token
  try {
    const decoded: any = jwt.decode(cleanToken);
    if (decoded && typeof decoded === 'object') {
      const isFirebaseToken =
        decoded.iss?.includes('securetoken.google.com') ||
        decoded.firebase !== undefined ||
        decoded.aud === projectId;

      if (isFirebaseToken) {
        // STRICT SECURITY: Must possess either admin custom claim or allowlisted admin email
        const hasAdminClaim = decoded.admin === true;
        const isAllowlistedEmail = Boolean(
          decoded.email &&
          adminEmails.includes(decoded.email.toLowerCase())
        );

        if (hasAdminClaim || isAllowlistedEmail) {
          const nowSec = Math.floor(Date.now() / 1000);
          // Allow 5 minutes clock skew tolerance
          if (decoded.exp && decoded.exp > nowSec - 300) {
            return true;
          }
        }
      }
    }
  } catch {}

  return false;
}

/**
 * Verifies admin session from cookie or authorization header.
 * Supports both Firebase Auth ID tokens (with allowlist) and ArcStonks Admin JWT tokens.
 */
export function verifyAdminSession(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const headerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (cookieToken && validateAdminToken(cookieToken)) {
    return true;
  }

  if (headerToken && validateAdminToken(headerToken)) {
    return true;
  }

  return false;
}

/**
 * Creates an unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
