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
 * Verifies admin JWT token from cookie or authorization header
 */
export function verifyAdminSession(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return false;

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
