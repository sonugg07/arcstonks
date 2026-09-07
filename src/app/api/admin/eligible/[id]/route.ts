import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { updateEligibleWallet, deleteEligibleWallet } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { allocation, status } = body;

    const allocNumber = parseInt(allocation, 10);
    const parsedAlloc = isNaN(allocNumber) || allocNumber < 1 ? 1 : allocNumber;

    const updated = updateEligibleWallet(id, parsedAlloc, status || 'active');
    if (updated) {
      return NextResponse.json({ success: true, message: 'Wallet updated.' });
    }
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const deleted = deleteEligibleWallet(id);
    if (deleted) {
      return NextResponse.json({ success: true, message: 'Wallet deleted.' });
    }
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
