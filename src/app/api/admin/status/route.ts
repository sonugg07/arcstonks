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

    // 1. Discover all root collections in Firestore
    try {
      const discovered = await db.listCollections();
      firestoreDiagnostic.discoveredCollections = discovered.map(c => c.id);
    } catch (listErr: any) {
      firestoreDiagnostic.listCollectionsError = listErr.message;
    }

    // 2. Query each relevant collection and alias
    const targetCollections = [
      'waitlist_users',
      'waitlist',
      'users',
      'eligible_wallets',
      'eligible',
      'whitelist',
      'waitlist_tasks',
      'tasks',
      'site_settings',
      'settings',
      'waitlist_task_completions',
      'task_completions',
      'admins',
    ];

    for (const colName of targetCollections) {
      try {
        const colRef = db.collection(colName);
        let count = 0;
        try {
          const countSnap = await colRef.count().get();
          count = countSnap.data().count;
        } catch {
          const snap = await colRef.select().get();
          count = snap.size;
        }

        let sampleIds: string[] = [];
        let sampleData: any[] = [];
        if (count > 0) {
          const sampleSnap = await colRef.limit(5).get();
          sampleIds = sampleSnap.docs.map(d => d.id);
          sampleData = sampleSnap.docs.map(d => {
            const data = d.data() || {};
            return {
              id: d.id,
              wallet_address: data.wallet_address || data.address || undefined,
              created_at: data.created_at || undefined,
              allocation: data.allocation || undefined,
              title: data.title || undefined,
              waitlist_enabled: data.waitlist_enabled !== undefined ? data.waitlist_enabled : undefined,
              checker_enabled: data.checker_enabled !== undefined ? data.checker_enabled : undefined,
            };
          });
        }

        firestoreDiagnostic.collections[colName] = {
          count,
          sampleIds,
          sampleData,
          exists: count > 0 || sampleIds.length > 0,
        };
      } catch (colErr: any) {
        firestoreDiagnostic.collections[colName] = {
          count: 0,
          error: colErr.message,
          errorCode: colErr.code || null,
        };
      }
    }

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
