import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { deleteWaitlistUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const deleted = deleteWaitlistUser(id);
    if (deleted) {
      return NextResponse.json({ success: true, message: 'Waitlist entry deleted.' });
    }
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
