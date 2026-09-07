import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { updateTask, deleteTask } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid Task ID.' }, { status: 400 });
    }

    const body = await request.json();
    const updated = updateTask(id, body);

    if (updated) {
      return NextResponse.json({ success: true, message: 'Task updated successfully.' });
    }
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
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
      return NextResponse.json({ error: 'Invalid Task ID.' }, { status: 400 });
    }

    const deleted = deleteTask(id);
    if (deleted) {
      return NextResponse.json({ success: true, message: 'Task deleted successfully.' });
    }
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
