import { NextRequest, NextResponse } from 'next/server';
import { recordTaskCompletion, isProofUsedByAnotherWallet } from '@/lib/db';
import { isValidEvmAddress, normalizeAddress } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, taskId, proof, actionOpenedAt } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required.' }, { status: 400 });
    }

    const normalized = normalizeAddress(address);
    if (!isValidEvmAddress(normalized)) {
      return NextResponse.json({ error: 'Invalid EVM wallet address format.' }, { status: 400 });
    }

    const parsedTaskId = parseInt(taskId, 10);
    if (isNaN(parsedTaskId)) {
      return NextResponse.json({ error: 'Valid Task ID is required.' }, { status: 400 });
    }

    // Require genuine X / social proof (handle or post link)
    if (!proof || typeof proof !== 'string' || !proof.trim()) {
      return NextResponse.json(
        { error: 'Proof required: Please provide your X (Twitter) handle (e.g. @yourhandle) or action link to verify.' },
        { status: 400 }
      );
    }

    const cleanProof = proof.trim();
    // Validate format: either an @handle, handle without @, or URL
    const isHandle = /^@?[A-Za-z0-9_]{1,15}$/.test(cleanProof);
    const isUrl = /^https?:\/\/.+/i.test(cleanProof);

    if (!isHandle && !isUrl) {
      return NextResponse.json(
        { error: 'Invalid format. Please enter a valid X (Twitter) username (e.g. @username) or proof link.' },
        { status: 400 }
      );
    }

    // Anti-rush timing check if actionOpenedAt was provided
    if (actionOpenedAt && typeof actionOpenedAt === 'number') {
      const elapsed = Date.now() - actionOpenedAt;
      if (elapsed < 3000) {
        const remaining = Math.ceil((3000 - elapsed) / 1000);
        return NextResponse.json(
          { error: `Please perform the action on X before verifying. Please wait ${remaining} more second(s).` },
          { status: 400 }
        );
      }
    }

    // Anti-Sybil check: prevent same X handle from being used across multiple wallets
    if (isProofUsedByAnotherWallet(cleanProof, parsedTaskId, normalized)) {
      return NextResponse.json(
        { error: `The social account "${cleanProof}" has already been verified for another wallet. Each wallet entry must use a unique account.` },
        { status: 400 }
      );
    }

    const formattedProof = isHandle && !cleanProof.startsWith('@') ? `@${cleanProof}` : cleanProof;
    const result = recordTaskCompletion(normalized, parsedTaskId, formattedProof);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to record task completion.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      taskId: parsedTaskId,
      proof: result.proofValue || formattedProof,
      verifiedAt: result.verifiedAt,
      message: `Task successfully verified for ${formattedProof}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
