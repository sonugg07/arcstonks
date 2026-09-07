import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getEligibleWallets, addEligibleWallet } from '@/lib/db';
import { isValidEvmAddress, normalizeAddress } from '@/lib/validation';

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

    const result = getEligibleWallets(search, limit, offset);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { address, allocation } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required.' }, { status: 400 });
    }

    const normalized = normalizeAddress(address);
    if (!isValidEvmAddress(normalized)) {
      return NextResponse.json({ error: 'Invalid 0x EVM wallet address format.' }, { status: 400 });
    }

    const allocNumber = parseInt(allocation, 10);
    const parsedAlloc = isNaN(allocNumber) || allocNumber < 1 ? 1 : allocNumber;

    const result = addEligibleWallet(normalized, parsedAlloc);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to add wallet' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet added to eligible list.',
      wallet: result.wallet,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
