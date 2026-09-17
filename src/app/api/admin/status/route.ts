import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, unauthorizedResponse } from '@/lib/auth';
import { getAdminDb, getProjectId, hasAdminCredentials, getCredentialSource } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return unauthorizedResponse();
  }

  const projectId = getProjectId();
  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_ADMIN_CREDENTIALS ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ||
    process.env.FIREBASE_CREDENTIALS ||
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  const envDiagnostic = {
    projectId,
    hasServiceAccountKey: Boolean(rawServiceAccount),
    serviceAccountKeyLength: rawServiceAccount ? rawServiceAccount.length : 0,
    hasClientEmailEnv: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKeyEnv: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    hasGoogleAppCredsFile: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    hasAdminCredentialsDetected: hasAdminCredentials(),
    credentialSource: getCredentialSource(),
  };

  let firestoreDiagnostic: any = {
    connected: false,
    error: null,
    errorCode: null,
    discoveredCollections: [] as string[],
    collections: {} as Record<string, any>,
  };

  try {
    const db = getAdminDb();

    // 1. Discover collections with timeout
    try {
      const discovered = await Promise.race([
        db.listCollections(),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('listCollections timeout')), 3000)),
      ]);
      firestoreDiagnostic.discoveredCollections = discovered.map(c => c.id);
    } catch (listErr: any) {
      firestoreDiagnostic.listCollectionsError = listErr.message;
    }

    // 2. Query canonical collections in parallel
    const targetCollections = [
      'waitlist_users',
      'eligible_wallets',
      'waitlist_tasks',
      'site_settings',
      'waitlist_task_completions',
      'admins',
    ];

    const queryPromises = targetCollections.map(async (colName) => {
      try {
        const colRef = db.collection(colName);
        const countSnap = await Promise.race([
          colRef.count().get(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('count timeout')), 2500)),
        ]);
        const count = countSnap.data().count;

        let sampleIds: string[] = [];
        if (count > 0) {
          const sampleSnap = await Promise.race([
            colRef.limit(3).get(),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('sample timeout')), 2000)),
          ]);
          sampleIds = sampleSnap.docs.map((d: any) => d.id);
        }

        return {
          colName,
          count,
          sampleIds,
          exists: count > 0 || sampleIds.length > 0,
        };
      } catch (colErr: any) {
        return {
          colName,
          count: 0,
          error: colErr.message,
          errorCode: colErr.code || null,
        };
      }
    });

    const results = await Promise.allSettled(queryPromises);
    results.forEach((res, index) => {
      const colName = targetCollections[index];
      if (res.status === 'fulfilled') {
        firestoreDiagnostic.collections[colName] = res.value;
      } else {
        firestoreDiagnostic.collections[colName] = {
          count: 0,
          error: res.reason?.message || 'Query failed',
        };
      }
    });

    firestoreDiagnostic.connected = true;
  } catch (err: any) {
    firestoreDiagnostic.connected = false;
    firestoreDiagnostic.error = err.message;
    firestoreDiagnostic.errorCode = err.code || null;
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    environment: envDiagnostic,
    firestore: firestoreDiagnostic,
  });
}
