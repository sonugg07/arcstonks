import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey:
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    'AIzaSyDummyArcStonksKeyForBuildTime00',
  authDomain:
    process.env.VITE_FIREBASE_AUTH_DOMAIN ||
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    process.env.FIREBASE_AUTH_DOMAIN ||
    'arcstonks.firebaseapp.com',
  projectId:
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'arcstonks',
  storageBucket:
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    'arcstonks.appspot.com',
  messagingSenderId:
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    '100000000000',
  appId:
    process.env.VITE_FIREBASE_APP_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    process.env.FIREBASE_APP_ID ||
    '1:100000000000:web:abcdef123456',
};

let app: FirebaseApp;
let firestoreDb: Firestore;
let firebaseAuth: Auth;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
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
    if (!firebaseAuth) {
      const a = getFirebaseApp();
      firebaseAuth = getAuth(a);
    }
    return firebaseAuth;
  } catch (err) {
    console.warn('Firebase Auth initialization skipped or failed:', err);
    return null;
  }
}

export const getDb = getFirebaseDb;
export const getAuthInstance = getFirebaseAuth;
export default getFirebaseApp;
