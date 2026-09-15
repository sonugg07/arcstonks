import { initializeApp, getApps, cert, applicationDefault, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

/**
 * Normalizes and resolves the Firebase Project ID for server environments.
 */
export function getProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'arcstonks'
  ).trim();
}

/**
 * Detects whether explicit Firebase Admin service-account credentials are present.
 */
export function hasAdminCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT) {
    return true;
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return true;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) return true;
    } catch {}
  }
  try {
    const localKeyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) return true;
  } catch {}
  return false;
}

/**
 * Initializes and returns the Firebase Admin App instance (singleton).
 */
export function getFirebaseAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps && existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId = getProjectId();
  let credential: any = null;

  // 1. JSON String or Base64 in FIREBASE_SERVICE_ACCOUNT_KEY / FIREBASE_SERVICE_ACCOUNT
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountRaw) {
    try {
      let parsed: any;
      const trimmed = serviceAccountRaw.trim();
      if (trimmed.startsWith('{')) {
        parsed = JSON.parse(trimmed);
      } else {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
        parsed = JSON.parse(decoded);
      }
      credential = cert(parsed);
      console.log('[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT credential.');
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', err.message);
    }
  }

  // 2. Individual Environment Variables (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)
  if (!credential && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL.trim();
      let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
      // Unescape \n in private key
      privateKey = privateKey.replace(/\\n/g, '\n');
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
      }
      credential = cert({
        projectId,
        clientEmail,
        privateKey,
      } as ServiceAccount);
      console.log('[Firebase Admin] Initialized with FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.');
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to initialize with private key vars:', err.message);
    }
  }

  // 3. GOOGLE_APPLICATION_CREDENTIALS File
  if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const gPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
      if (fs.existsSync(gPath)) {
        const fileContent = JSON.parse(fs.readFileSync(gPath, 'utf-8'));
        credential = cert(fileContent);
        console.log(`[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file: ${gPath}`);
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to load GOOGLE_APPLICATION_CREDENTIALS:', err.message);
    }
  }

  // 4. Local serviceAccountKey.json file in root
  if (!credential) {
    try {
      const localKey = path.join(process.cwd(), 'serviceAccountKey.json');
      if (fs.existsSync(localKey)) {
        const fileContent = JSON.parse(fs.readFileSync(localKey, 'utf-8'));
        credential = cert(fileContent);
        console.log('[Firebase Admin] Initialized with local serviceAccountKey.json.');
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to read local serviceAccountKey.json:', err.message);
    }
  }

  // 5. Application Default Credentials (ADC) or Project ID Fallback
  if (!credential) {
    try {
      credential = applicationDefault();
      console.log('[Firebase Admin] Using Application Default Credentials (ADC).');
    } catch {
      console.log(`[Firebase Admin] Initializing with project ID: ${projectId} (Ambient/Project fallback).`);
    }
  }

  adminApp = initializeApp({
    credential: credential || undefined,
    projectId,
  });

  return adminApp;
}

/**
 * Returns the singleton Firestore instance from the Firebase Admin SDK.
 */
export function getAdminDb(): Firestore {
  if (!adminDb) {
    const app = getFirebaseAdminApp();
    adminDb = getFirestore(app);
  }
  return adminDb;
}

/**
 * Returns the singleton Auth instance from the Firebase Admin SDK.
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = getFirebaseAdminApp();
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export default getAdminDb;
