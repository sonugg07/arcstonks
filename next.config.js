function sanitizeEnv(val) {
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

const rawApiKey = sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY);
const rawProjectId = sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID) || 'arcstonks';
const rawAuthDomain = sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN) || `${rawProjectId}.firebaseapp.com`;
const rawStorageBucket = sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET) || `${rawProjectId}.firebasestorage.app`;
const rawSenderId = sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID);
const rawAppId = sanitizeEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: rawApiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: rawAuthDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: rawProjectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: rawStorageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: rawSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: rawAppId,

    VITE_FIREBASE_API_KEY: rawApiKey,
    VITE_FIREBASE_AUTH_DOMAIN: rawAuthDomain,
    VITE_FIREBASE_PROJECT_ID: rawProjectId,
    VITE_FIREBASE_STORAGE_BUCKET: rawStorageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: rawSenderId,
    VITE_FIREBASE_APP_ID: rawAppId,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
};

module.exports = nextConfig;
