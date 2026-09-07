import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { batchImportEligibleWallets } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { csvText, defaultAllocation } = body;

    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 });
    }

    const fallbackAlloc = parseInt(defaultAllocation, 10) || 1;

    // Split lines
    const rawLines = csvText.split(/\r?\n/);
    const recordsToProcess: { rawAddress: string; allocation: number }[] = [];

    let headerChecked = false;
    let addressColIdx = 0;
    let allocColIdx = -1;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;

      // Handle comma or semicolon separated values
      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));

      if (!headerChecked) {
        headerChecked = true;
        const lowerFirst = cols[0].toLowerCase();
        if (lowerFirst.includes('wallet') || lowerFirst.includes('address')) {
          // It's a header line!
          addressColIdx = cols.findIndex(c => c.toLowerCase().includes('address') || c.toLowerCase().includes('wallet'));
          if (addressColIdx === -1) addressColIdx = 0;

          allocColIdx = cols.findIndex(c => c.toLowerCase().includes('alloc'));
          continue;
        }
      }

      const rawAddr = cols[addressColIdx] || cols[0];
      let alloc = fallbackAlloc;
      if (allocColIdx !== -1 && cols[allocColIdx]) {
        const parsed = parseInt(cols[allocColIdx], 10);
        if (!isNaN(parsed) && parsed > 0) {
          alloc = parsed;
        }
      }

      if (rawAddr) {
        recordsToProcess.push({ rawAddress: rawAddr, allocation: alloc });
      }
    }

    if (recordsToProcess.length === 0) {
      return NextResponse.json({ error: 'No wallet entries found in CSV' }, { status: 400 });
    }

    const result = batchImportEligibleWallets(recordsToProcess);

    return NextResponse.json({
      success: true,
      message: `Imported ${result.successfulCount} wallets successfully.`,
      result,
    });
  } catch (error: any) {
    console.error('CSV import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
