import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Sanitizes environment variable values by trimming whitespace and stripping
 * accidental leading/trailing quotes (e.g. if pasted as `"AIzaSy..."` into Vercel).
 */
function cleanEnv(val?: string): string {
  if (!val || typeof val !== 'string') return '';
  let trimmed = val.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Environment Variable Resolution (Supports NEXT_PUBLIC_*, VITE_*, and bare names)
// ---------------------------------------------------------------------------
const apiKey = cleanEnv(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY
);

const projectId = cleanEnv(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID
) || 'arcstonks';

const authDomain = cleanEnv(
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  process.env.VITE_FIREBASE_AUTH_DOMAIN ||
  process.env.FIREBASE_AUTH_DOMAIN
) || `${projectId}.firebaseapp.com`;

const storageBucket = cleanEnv(
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  process.env.FIREBASE_STORAGE_BUCKET
) || `${projectId}.firebasestorage.app`;

const messagingSenderId = cleanEnv(
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
  process.env.FIREBASE_MESSAGING_SENDER_ID
);

const appId = cleanEnv(
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
  process.env.VITE_FIREBASE_APP_ID ||
  process.env.FIREBASE_APP_ID
);

export const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

export interface FirebaseConfigValidation {
  isValid: boolean;
  hasApiKey: boolean;
  missingVariables: string[];
  projectId: string;
}

/**
 * Validates whether required Firebase environment variables are configured.
 * Safely logs missing variables in the console without leaking secrets.
 */
export function validateFirebaseConfig(): FirebaseConfigValidation {
  const missing: string[] = [];

  if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
    missing.push('NEXT_PUBLIC_FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY)');
  }
  if (!appId) {
    missing.push('NEXT_PUBLIC_FIREBASE_APP_ID (or VITE_FIREBASE_APP_ID)');
  }

  const isValid = missing.length === 0;

  if (!isValid && typeof window !== 'undefined') {
    console.warn(
      `%c[ArcStonks Firebase Config Notice]%c Missing environment variable(s):\n${missing.map(m => `  • ${m}`).join('\n')}\n` +
      `Configure these in Vercel Dashboard -> Project Settings -> Environment Variables and redeploy.`,
      'color: #f59e0b; font-weight: bold;',
      'color: inherit;'
    );
  }

  return {
    isValid,
    hasApiKey: Boolean(apiKey && !apiKey.startsWith('AIzaSyDummy')),
    missingVariables: missing,
    projectId,
  };
}

let app: FirebaseApp;
let firestoreDb: Firestore;
let firebaseAuth: Auth;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existing = getApps();
    if (existing.length > 0) {
      app = existing[0];
    } else {
      // If apiKey is present, initialize with complete config.
      // If apiKey is missing (e.g. during static build), initialize minimal config so build does not crash.
      if (apiKey && !apiKey.startsWith('AIzaSyDummy')) {
        app = initializeApp(firebaseConfig);
      } else {
        app = initializeApp({
          projectId,
          authDomain,
          storageBucket,
        });
      }
    }
  }
  return app;
}

export function getFirebaseDb(): Firestore {
  if (!firestoreDb) {
    const a = getFirebaseApp();
    firestoreDb = getFirestore(a);
  }
  return firestoreDb;
}

export function getFirebaseAuth(): Auth | null {
  try {
    // Check if valid apiKey exists before initializing Auth
    if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
      if (typeof window !== 'undefined') {
        console.warn('[Firebase Auth] Initialization deferred: Missing Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY or VITE_FIREBASE_API_KEY).');
      }
      return null;
    }

    if (!firebaseAuth) {
      const a = getFirebaseApp();
      firebaseAuth = getAuth(a);
    }
    return firebaseAuth;
  } catch (err: any) {
    console.warn('[Firebase Auth] Initialization error:', err?.message || err);
    return null;
  }
}

export const getDb = getFirebaseDb;
export const getAuthInstance = getFirebaseAuth;
export default getFirebaseApp;
