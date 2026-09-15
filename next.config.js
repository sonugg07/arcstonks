/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').replace(/^["']|["']$/g, '').trim(),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'arcstonks.firebaseapp.com').replace(/^["']|["']$/g, '').trim(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'arcstonks').replace(/^["']|["']$/g, '').trim(),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'arcstonks.firebasestorage.app').replace(/^["']|["']$/g, '').trim(),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '').replace(/^["']|["']$/g, '').trim(),
    NEXT_PUBLIC_FIREBASE_APP_ID:
      (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '').replace(/^["']|["']$/g, '').trim(),

    VITE_FIREBASE_API_KEY:
      (process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').replace(/^["']|["']$/g, '').trim(),
    VITE_FIREBASE_AUTH_DOMAIN:
      (process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'arcstonks.firebaseapp.com').replace(/^["']|["']$/g, '').trim(),
    VITE_FIREBASE_PROJECT_ID:
      (process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'arcstonks').replace(/^["']|["']$/g, '').trim(),
    VITE_FIREBASE_STORAGE_BUCKET:
      (process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'arcstonks.firebasestorage.app').replace(/^["']|["']$/g, '').trim(),
    VITE_FIREBASE_MESSAGING_SENDER_ID:
      (process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '').replace(/^["']|["']$/g, '').trim(),
    VITE_FIREBASE_APP_ID:
      (process.env.VITE_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '').replace(/^["']|["']$/g, '').trim(),
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
};

module.exports = nextConfig;
