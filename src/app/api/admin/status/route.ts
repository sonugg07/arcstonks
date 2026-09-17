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

    // 1. Direct doc read test on site_settings
    const settingsStart = Date.now();
    try {
      const setSnap = await db.collection('site_settings').doc('global').get();
      firestoreDiagnostic.directDocRead = {
        success: true,
        exists: setSnap.exists,
        durationMs: Date.now() - settingsStart,
        data: setSnap.data() || null,
      };
    } catch (setErr: any) {
      firestoreDiagnostic.directDocRead = {
        success: false,
        durationMs: Date.now() - settingsStart,
        error: setErr.message,
        code: setErr.code || null,
      };
    }

    // 2. Discover collections with 6s timeout
    try {
      const listStart = Date.now();
      const discovered = await Promise.race([
        db.listCollections(),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('listCollections timeout after 6s')), 6000)),
      ]);
      firestoreDiagnostic.discoveredCollections = discovered.map(c => c.id);
      firestoreDiagnostic.listCollectionsDurationMs = Date.now() - listStart;
    } catch (listErr: any) {
      firestoreDiagnostic.listCollectionsError = listErr.message;
    }

    // 3. Query canonical collections
    const targetCollections = [
      'waitlist_users',
      'eligible_wallets',
      'waitlist_tasks',
      'site_settings',
      'waitlist_task_completions',
      'admins',
    ];

    const queryPromises = targetCollections.map(async (colName) => {
      const colRef = db.collection(colName);
      const colResult: any = { colName };

      // Test A: Direct read (limit 5)
      const readStart = Date.now();
      try {
        const sampleSnap = await colRef.limit(5).get();
        colResult.directRead = {
          success: true,
          docsFound: sampleSnap.size,
          sampleIds: sampleSnap.docs.map(d => d.id),
          durationMs: Date.now() - readStart,
        };
      } catch (rErr: any) {
        colResult.directRead = {
          success: false,
          error: rErr.message,
          code: rErr.code || null,
          durationMs: Date.now() - readStart,
        };
      }

      // Test B: Count aggregation
      const countStart = Date.now();
      try {
        const countSnap = await colRef.count().get();
        colResult.countAggregation = {
          success: true,
          count: countSnap.data().count,
          durationMs: Date.now() - countStart,
        };
      } catch (cErr: any) {
        colResult.countAggregation = {
          success: false,
          error: cErr.message,
          code: cErr.code || null,
          durationMs: Date.now() - countStart,
        };
      }

      colResult.count = colResult.countAggregation?.count ?? colResult.directRead?.docsFound ?? 0;
      return colResult;
    });

    const results = await Promise.allSettled(queryPromises);
    results.forEach((res, index) => {
      const colName = targetCollections[index];
      if (res.status === 'fulfilled') {
        firestoreDiagnostic.collections[colName] = res.value;
      } else {
        firestoreDiagnostic.collections[colName] = {
          colName,
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
