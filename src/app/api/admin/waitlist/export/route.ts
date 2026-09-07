import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAllWaitlistAddressesForExport } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const addresses = getAllWaitlistAddressesForExport();

    // Create CSV formatted string with ONLY wallet_address
    const csvHeader = 'wallet_address\r\n';
    const csvRows = addresses.join('\r\n');
    const csvContent = csvHeader + csvRows;

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `waitlist_wallets_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
