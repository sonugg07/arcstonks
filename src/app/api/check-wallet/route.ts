import { NextRequest, NextResponse } from 'next/server';
import { getSettings, checkWalletEligibility } from '@/lib/db';
import { isValidEvmAddress, normalizeAddress } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const settings = getSettings();
    if (!settings.checker_enabled) {
      return NextResponse.json(
        { error: 'Wallet Checker is currently unavailable.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawAddress = searchParams.get('address');

    if (!rawAddress) {
      return NextResponse.json({ error: 'Missing address parameter.' }, { status: 400 });
    }

    const normalized = normalizeAddress(rawAddress);
    if (!isValidEvmAddress(normalized)) {
      return NextResponse.json(
        { error: 'Invalid EVM address format. Must be a valid 0x hex address.' },
        { status: 400 }
      );
    }

    const result = checkWalletEligibility(normalized);

    if (result.eligible) {
      return NextResponse.json({
        address: normalized,
        eligible: true,
        allocation: result.allocation || 1,
        status: result.status || 'active',
        message: 'Congratulations! This wallet is eligible for the ArcStonks NFT whitelist.',
      });
    }

    return NextResponse.json({
      address: normalized,
      eligible: false,
      message: 'This wallet is not currently on the eligible list.',
    });
  } catch (error: any) {
    console.error('Wallet check error:', error);
    return NextResponse.json({ error: 'Server error checking wallet.' }, { status: 500 });
  }
}
