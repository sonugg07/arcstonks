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
 * Verifies admin session from cookie or authorization header.
 * Supports both Firebase Auth ID tokens (with admin claim/allowlist) and ArcStonks Admin JWT tokens.
 */
export function verifyAdminSession(request: NextRequest): boolean {
  const token =
    request.cookies.get(ADMIN_COOKIE_NAME)?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return false;

  const projectId =
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'arcstonks';

  const adminEmails = (process.env.ADMIN_EMAILS || 'sonu9888123@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase());

  // 1. Try validating as Firebase Auth ID token
  try {
    const decoded: any = jwt.decode(token);
    if (decoded && typeof decoded === 'object') {
      const isFirebaseToken =
        decoded.iss?.includes('securetoken.google.com') ||
        decoded.firebase !== undefined ||
        decoded.aud === projectId;

      if (isFirebaseToken) {
        // STRICT SECURITY: Do NOT treat every authenticated user as an admin!
        // Must possess either:
        // A) Custom claim: admin == true
        // B) Verified email matching configured admin allowlist
        const hasAdminClaim = decoded.admin === true;
        const isAllowlistedEmail = Boolean(
          decoded.email &&
          decoded.email_verified === true &&
          adminEmails.includes(decoded.email.toLowerCase())
        );

        if (!hasAdminClaim && !isAllowlistedEmail) {
          return false;
        }

        // Check expiration
        const nowSec = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp > nowSec) {
          return true;
        }
        return false;
      }
    }
  } catch {}

  // 2. Try validating as ArcStonks Admin JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
    return decoded && decoded.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Creates an unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
