import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAllWaitlistAddressesForExport, batchImportEligibleWallets } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const allocation = parseInt(body.allocation, 10) || 1;

    const addresses = getAllWaitlistAddressesForExport();
    if (addresses.length === 0) {
      return NextResponse.json({ error: 'Waitlist is currently empty' }, { status: 400 });
    }

    const records = addresses.map(addr => ({ rawAddress: addr, allocation }));
    const result = batchImportEligibleWallets(records);

    return NextResponse.json({
      success: true,
      message: `Imported ${result.successfulCount} waitlist wallets into eligible list.`,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
