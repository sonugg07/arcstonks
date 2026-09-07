import { NextRequest, NextResponse } from 'next/server';
import { getSettings, addWaitlistUser, checkRequiredTasksCompleted } from '@/lib/db';
import { isValidEvmAddress, normalizeAddress } from '@/lib/validation';
import { verifyTurnstileToken, generateArcChallenge } from '@/lib/captcha';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Generate a fresh server-signed cryptographic challenge for anti-bot fallback
  try {
    const challenge = generateArcChallenge();
    return NextResponse.json(challenge);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const settings = getSettings();
    if (!settings.waitlist_enabled) {
      return NextResponse.json(
        { error: 'The ArcStonks waitlist is currently closed. Stay tuned on our community channels!' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { address, captchaToken, xHandle } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required.' }, { status: 400 });
    }

    const normalized = normalizeAddress(address);
    if (!isValidEvmAddress(normalized)) {
      return NextResponse.json(
        { error: 'Invalid EVM wallet address. Must start with 0x and be 42 characters hex.' },
        { status: 400 }
      );
    }

    if (!captchaToken || typeof captchaToken !== 'string') {
      return NextResponse.json(
        { error: 'Anti-bot verification required. Please complete verification before submitting.' },
        { status: 400 }
      );
    }

    // Determine client IP for Turnstile verification
    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;

    // Server-side verification of CAPTCHA/anti-bot token
    const captchaResult = await verifyTurnstileToken(captchaToken, remoteIp);
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.message || 'Anti-bot verification failed. Please try again.' },
        { status: 403 }
      );
    }

    // Verify all required community tasks are completed
    const taskCheck = checkRequiredTasksCompleted(normalized);
    if (!taskCheck.allCompleted) {
      return NextResponse.json(
        {
          error: `Please complete all required community tasks before joining the waitlist. Missing: ${taskCheck.missingTasks.join(', ')}`,
          missingTasks: taskCheck.missingTasks,
          completedRequired: taskCheck.completedRequired,
          requiredTotal: taskCheck.requiredTotal,
        },
        { status: 400 }
      );
    }

    // Add to waitlist_users persistent database
    const result = addWaitlistUser(normalized, remoteIp, xHandle);

    if (result.alreadyExists) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: 'This wallet address is already registered on the ArcStonks waitlist!',
        entry: result.entry,
      });
    }

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      message: 'Welcome to the ArcStonks Waitlist! Your wallet has been successfully recorded.',
      entry: result.entry,
    });
  } catch (error: any) {
    console.error('Waitlist submission error:', error);
    return NextResponse.json({ error: 'Server error processing waitlist submission.' }, { status: 500 });
  }
}
