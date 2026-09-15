import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { updateTask, deleteTask } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const id = params.id;
    if (!id || !id.trim()) {
      return NextResponse.json({ error: 'Invalid Task ID.' }, { status: 400 });
    }

    const body = await request.json();
    const updated = await updateTask(id.trim(), body);

    if (updated) {
      return NextResponse.json({ success: true, message: 'Task updated successfully.' });
    }
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  return PUT(request, context);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const id = params.id;
    if (!id || !id.trim()) {
      return NextResponse.json({ error: 'Invalid Task ID.' }, { status: 400 });
    }

    const deleted = await deleteTask(id.trim());
    if (deleted) {
      return NextResponse.json({ success: true, message: 'Task deleted successfully.' });
    }
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
