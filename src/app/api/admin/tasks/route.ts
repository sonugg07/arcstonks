import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAllTasksAdmin, createTask } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  try {
    const tasks = getAllTasksAdmin();
    return NextResponse.json({ tasks });
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
    const { title, type, url, required, enabled, display_order } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required.' }, { status: 400 });
    }
    if (!type || typeof type !== 'string' || !type.trim()) {
      return NextResponse.json({ error: 'Task type is required.' }, { status: 400 });
    }
    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'Task URL is required.' }, { status: 400 });
    }

    const task = createTask({
      title,
      type,
      url,
      required: required !== undefined ? Boolean(required) : true,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      display_order: parseInt(display_order, 10) || 0,
    });

    return NextResponse.json({
      success: true,
      task,
      message: 'Task created successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
