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
 * Safely parses and normalizes a Firebase Service Account JSON or Base64 string.
 */
function parseServiceAccountString(raw?: string): ServiceAccount | null {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw.trim();
  if (!str) return null;

  // 1. Remove UTF-8 Byte Order Mark if present
  if (str.charCodeAt(0) === 0xFEFF) {
    str = str.slice(1).trim();
  }

  // 2. Strip surrounding quotes (single or double) that may be added by env editors
  while ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // 3. Handle double-escaped JSON strings (e.g. \"type\": \"service_account\")
  if (str.includes('\\"') && !str.includes('{"')) {
    try {
      str = JSON.parse(`"${str}"`);
    } catch {}
  }

  let parsed: any = null;

  // 4. Try parsing as direct JSON object
  if (str.startsWith('{')) {
    try {
      parsed = JSON.parse(str);
    } catch (e1) {
      // Try replacing literal unescaped newlines inside strings
      try {
        parsed = JSON.parse(str.replace(/\r?\n/g, '\\n'));
      } catch {}
    }
  }

  // 5. Try Base64 decoding if not direct JSON
  if (!parsed) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8');
      if (decoded.trim().startsWith('{')) {
        parsed = JSON.parse(decoded);
      }
    } catch {}
  }

  // 6. Validate and normalize the parsed object
  if (parsed && typeof parsed === 'object') {
    let privateKey = (parsed.private_key || parsed.privateKey || '').trim();
    privateKey = privateKey.replace(/\\n/g, '\n');
    while ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1).trim();
    }

    const clientEmail = (parsed.client_email || parsed.clientEmail || '').trim();
    const resolvedProjectId = (parsed.project_id || parsed.projectId || getProjectId()).trim();

    if (privateKey && clientEmail) {
      return {
        projectId: resolvedProjectId,
        clientEmail,
        privateKey,
        project_id: resolvedProjectId,
        client_email: clientEmail,
        private_key: privateKey,
      } as any;
    }
  }

  return null;
}

/**
 * Detects whether explicit Firebase Admin service-account credentials are present.
 */
export function hasAdminCredentials(): boolean {
  if (
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ) {
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
  let credentialSource = 'none';

  // 1. Check all JSON / Base64 service account environment variable aliases
  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (rawServiceAccount) {
    try {
      const parsed: any = parseServiceAccountString(rawServiceAccount);
      if (parsed && parsed.privateKey && parsed.clientEmail) {
        credential = cert(parsed);
        credentialSource = `service_account_env (${parsed.clientEmail})`;
        console.log(`[Firebase Admin] Authenticated with service account: ${parsed.clientEmail} for project: ${parsed.projectId || projectId}`);
      } else {
        console.warn('[Firebase Admin] Service account variable was present but could not be parsed into valid service account JSON.');
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to initialize cert from service account JSON:', err.message);
    }
  }

  // 2. Individual Environment Variables (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)
  if (!credential && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL.trim();
      let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim().replace(/\\n/g, '\n');
      while ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1).trim();
      }
      credential = cert({
        projectId,
        clientEmail,
        privateKey,
      } as ServiceAccount);
      credentialSource = `client_email_env (${clientEmail})`;
      console.log(`[Firebase Admin] Authenticated with FIREBASE_CLIENT_EMAIL: ${clientEmail}`);
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
        credentialSource = `credentials_file (${gPath})`;
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
        credentialSource = 'local_file (serviceAccountKey.json)';
        console.log('[Firebase Admin] Initialized with local serviceAccountKey.json.');
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Failed to read local serviceAccountKey.json:', err.message);
    }
  }

  // 5. Application Default Credentials (ADC) or Ambient Fallback
  if (!credential) {
    try {
      credential = applicationDefault();
      credentialSource = 'application_default_credentials';
      console.log('[Firebase Admin] Using Application Default Credentials (ADC).');
    } catch {
      credentialSource = 'ambient_project_id_only';
      console.log(`[Firebase Admin] Initializing with project ID: ${projectId} (ambient fallback).`);
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
