import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Sanitizes environment variable values by trimming whitespace, stripping accidental
 * quotes, trailing commas/semicolons, or object-property prefixes (e.g. if pasted as
 * `apiKey: "AIzaSy...",` into Vercel).
 */
export function cleanEnv(val?: string): string {
  if (!val || typeof val !== 'string') return '';
  let str = val.trim();
  // Strip key prefix if copied from JS object snippet (e.g., apiKey: "AIzaSy...")
  str = str.replace(/^[a-zA-Z0-9_]+[:=]\s*/, '');
  // Strip trailing comma or semicolon
  str = str.replace(/[,;]+$/, '').trim();
  // Strip surrounding quotes
  str = str.replace(/^["'`]|["'`]$/g, '').trim();
  // Strip trailing comma or semicolon again in case quotes were inside
  str = str.replace(/[,;]+$/, '').trim();
  str = str.replace(/^["'`]|["'`]$/g, '').trim();
  return str;
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

/**
 * Checks whether the configured key matches standard Google Web API key format:
 * Exactly 39 characters, starting with "AIzaSy", followed by 33 base64url characters.
 */
export function isValidGoogleApiKey(key?: string): boolean {
  if (!key) return false;
  return /^AIzaSy[a-zA-Z0-9_-]{33}$/.test(key);
}

export interface ApiKeyDiagnostic {
  hasKey: boolean;
  isValidGoogleFormat: boolean;
  keyLength: number;
  preview: string;
  formatNote: string;
}

/**
 * Produces safe diagnostic information about the configured Firebase API key
 * without leaking the full secret.
 */
export function getApiKeyDiagnostic(): ApiKeyDiagnostic {
  if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
    return {
      hasKey: false,
      isValidGoogleFormat: false,
      keyLength: 0,
      preview: 'Not configured',
      formatNote: 'Missing NEXT_PUBLIC_FIREBASE_API_KEY in environment',
    };
  }

  const isValidGoogleFormat = isValidGoogleApiKey(apiKey);
  const preview = apiKey.length > 8
    ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
    : `${apiKey.slice(0, 2)}***`;

  let formatNote = 'Valid Google API Key format (starts with AIzaSy, 39 characters).';
  if (!apiKey.startsWith('AIzaSy')) {
    formatNote = `Malformed API key: Starts with "${apiKey.slice(0, 6)}..." instead of "AIzaSy". Firebase Web API keys must start with AIzaSy.`;
  } else if (apiKey.length !== 39) {
    formatNote = `Malformed API key length: ${apiKey.length} characters (expected exactly 39 characters).`;
  }

  return {
    hasKey: true,
    isValidGoogleFormat,
    keyLength: apiKey.length,
    preview,
    formatNote,
  };
}

export interface FirebaseConfigValidation {
  isValid: boolean;
  hasApiKey: boolean;
  isValidGoogleApiKey: boolean;
  missingVariables: string[];
  projectId: string;
  diagnostic: ApiKeyDiagnostic;
}

/**
 * Validates whether required Firebase environment variables are configured.
 * Safely logs missing variables in the console without leaking secrets.
 */
export function validateFirebaseConfig(): FirebaseConfigValidation {
  const missing: string[] = [];
  const diagnostic = getApiKeyDiagnostic();

  if (!apiKey || apiKey.startsWith('AIzaSyDummy')) {
    missing.push('NEXT_PUBLIC_FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY)');
  }
  if (!appId) {
    missing.push('NEXT_PUBLIC_FIREBASE_APP_ID (or VITE_FIREBASE_APP_ID)');
  }

  const isValid = missing.length === 0 && diagnostic.isValidGoogleFormat;

  if (typeof window !== 'undefined') {
    if (missing.length > 0) {
      console.warn(
        `%c[ArcStonks Firebase Config Notice]%c Missing environment variable(s):\n${missing.map(m => `  • ${m}`).join('\n')}\n` +
        `Configure these in Vercel Dashboard -> Project Settings -> Environment Variables and redeploy.`,
        'color: #f59e0b; font-weight: bold;',
        'color: inherit;'
      );
    } else if (!diagnostic.isValidGoogleFormat) {
      console.warn(
        `%c[ArcStonks Firebase Key Warning]%c ${diagnostic.formatNote}\n` +
        `Please verify NEXT_PUBLIC_FIREBASE_API_KEY in Vercel. Google Firebase Web keys start with "AIzaSy".`,
        'color: #ef4444; font-weight: bold;',
        'color: inherit;'
      );
    }
  }

  return {
    isValid,
    hasApiKey: Boolean(apiKey && !apiKey.startsWith('AIzaSyDummy')),
    isValidGoogleApiKey: diagnostic.isValidGoogleFormat,
    missingVariables: missing,
    projectId,
    diagnostic,
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
