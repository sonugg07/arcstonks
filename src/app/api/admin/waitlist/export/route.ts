import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAllWaitlistEntriesForExport } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const entries = getAllWaitlistEntriesForExport();

    // Create CSV formatted string starting with wallet_address
    const csvHeader = 'wallet_address,x_handle,created_at\r\n';
    const csvRows = entries
      .map(e => `${e.wallet_address},${e.x_handle || ''},${e.created_at}`)
      .join('\r\n');
    const csvContent = csvHeader + csvRows;

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `wallet_address_${timestamp}.csv`;

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
