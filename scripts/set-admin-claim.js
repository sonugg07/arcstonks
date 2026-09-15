/**
 * ArcStonks Admin Claim Assignment Script
 * 
 * Usage:
 *   node scripts/set-admin-claim.js <admin-email-or-uid>
 * 
 * Requirements:
 *   1. Download serviceAccountKey.json from:
 *      Firebase Console -> Project Settings -> Service Accounts -> "Generate new private key"
 *   2. Place it in the root or scripts folder (or set GOOGLE_APPLICATION_CREDENTIALS)
 *   3. Run: node scripts/set-admin-claim.js admin@arcstonks.com
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function setAdminClaim() {
  const targetUser = process.argv[2] || process.env.ADMIN_TARGET_USER || 'sonu9888123@gmail.com';

  // Look for service account key in common locations
  const possibleKeyPaths = [
    path.join(__dirname, '..', 'serviceAccountKey.json'),
    path.join(__dirname, 'serviceAccountKey.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].filter(Boolean);

  let serviceAccount = null;
  for (const p of possibleKeyPaths) {
    if (fs.existsSync(p)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(p, 'utf-8'));
        console.log(`Loaded service account key from: ${p}`);
        break;
      } catch {}
    }
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'arcstonks';

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    console.log('No serviceAccountKey.json found. Attempting Application Default Credentials (ADC)...');
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    } catch (err) {
      console.error('\n[Error] Could not initialize Firebase Admin SDK:');
      console.error('Please download serviceAccountKey.json from Firebase Console:');
      console.error('Firebase Console -> Project Settings -> Service accounts -> "Generate new private key"');
      console.error('Place the JSON file in your project root as "serviceAccountKey.json".\n');
      process.exit(1);
    }
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    let user;
    if (targetUser.includes('@')) {
      console.log(`Looking up user by email: ${targetUser}...`);
      user = await auth.getUserByEmail(targetUser);
    } else {
      console.log(`Looking up user by UID: ${targetUser}...`);
      user = await auth.getUser(targetUser);
    }

    console.log(`Found user: ${user.email} (UID: ${user.uid})`);

    // 1. Set custom user claims { admin: true }
    console.log('Setting custom claim { admin: true }...');
    await auth.setCustomUserClaims(user.uid, { admin: true });

    // 2. Add document to /admins/{uid} collection for redundant multi-layer security
    console.log('Recording admin in /admins collection...');
    await db.collection('admins').doc(user.uid).set({
      email: user.email || '',
      uid: user.uid,
      role: 'admin',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('\n✅ SUCCESS: Admin privileges granted successfully!');
    console.log(`- UID: ${user.uid}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Custom Claim: { admin: true }`);
    console.log(`- Firestore /admins record: created`);
    console.log('\nThe user will now be recognized by Firestore Security Rules and the /admin panel.');
  } catch (err) {
    console.error('Failed to set admin claim:', err.message);
    process.exit(1);
  }
}

setAdminClaim();
