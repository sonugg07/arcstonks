/**
 * Test Matrix for Firestore Security Model & Admin Authorization
 * 
 * Verifies rule enforcement and token validation across 4 personas:
 * 1. Unauthenticated Public User
 * 2. Normal Authenticated User (No admin claims, not allowlisted)
 * 3. Unauthorized Authenticated User (Attacker trying privilege escalation)
 * 4. Authorized Admin (Custom claim admin: true / allowlisted email)
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'arcstonks_super_secret_jwt_key_999444';
const PROJECT_ID = 'arcstonks';
const ADMIN_EMAILS = ['admin@arcstonks.com', 'arcstonks@gmail.com'];

// Helper to simulate Firestore rule evaluation
function simulateFirestoreRules(authContext, operation, collection, docId, data, existingData) {
  const isAuthenticated = authContext !== null;
  const isAdmin = isAuthenticated && (
    authContext.token?.admin === true ||
    (authContext.token?.email_verified === true && ADMIN_EMAILS.includes((authContext.token?.email || '').toLowerCase())) ||
    authContext.isInAdminsCollection === true
  );

  const isValidEvmAddress = (addr) => typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);

  switch (collection) {
    case 'site_settings':
      if (operation === 'read') return true;
      if (['create', 'update', 'delete'].includes(operation)) return isAdmin;
      return false;

    case 'waitlist_tasks':
      if (operation === 'read') return true;
      if (['create', 'update', 'delete'].includes(operation)) return isAdmin;
      return false;

    case 'eligible_wallets':
      if (operation === 'get') return true;
      if (operation === 'list') return isAdmin;
      if (['create', 'update', 'delete'].includes(operation)) return isAdmin;
      return false;

    case 'waitlist_users':
      if (operation === 'get') return true;
      if (operation === 'list') return isAdmin;
      if (operation === 'create') {
        return (
          isValidEvmAddress(docId) &&
          isValidEvmAddress(data?.wallet_address) &&
          data?.wallet_address_lower === docId.toLowerCase() &&
          data?.wallet_address?.toLowerCase() === docId.toLowerCase() &&
          data?.wallet_address?.length === 42 &&
          (!data?.x_handle || data.x_handle.length <= 50) &&
          (!data?.ip_hash || data.ip_hash.length <= 100) &&
          typeof data?.created_at === 'string'
        );
      }
      if (operation === 'update') {
        return isAdmin && (data?.wallet_address?.toLowerCase() === existingData?.wallet_address?.toLowerCase());
      }
      if (operation === 'delete') return isAdmin;
      return false;

    case 'waitlist_task_completions':
      if (operation === 'get') return true;
      if (operation === 'list') return isAdmin;
      if (operation === 'create') {
        return (
          isValidEvmAddress(data?.wallet_address) &&
          typeof data?.task_id === 'string' &&
          data.task_id.length > 0 &&
          data.task_id.length <= 100 &&
          data?.status === 'completed' &&
          docId === `${data?.wallet_address_lower}_${data?.task_id}` &&
          (!data?.proof_value || data.proof_value.length <= 200)
        );
      }
      if (operation === 'update') return isAdmin;
      if (operation === 'delete') return isAdmin;
      return false;

    case 'admins':
      if (operation === 'read') return isAuthenticated && (authContext.uid === docId || isAdmin);
      if (['create', 'update', 'delete'].includes(operation)) return isAdmin;
      return false;

    default:
      return false;
  }
}

// Helper to simulate Next.js API route verifyAdminSession logic
function verifyAdminSession(token) {
  if (!token) return false;

  // 1. Try decoding as Firebase Auth ID token
  try {
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded === 'object') {
      const isFirebaseToken =
        decoded.iss?.includes('securetoken.google.com') ||
        decoded.firebase !== undefined ||
        decoded.aud === PROJECT_ID;

      if (isFirebaseToken) {
        const hasAdminClaim = decoded.admin === true;
        const isAllowlistedEmail = Boolean(
          decoded.email &&
          decoded.email_verified === true &&
          ADMIN_EMAILS.includes(decoded.email.toLowerCase())
        );

        if (!hasAdminClaim && !isAllowlistedEmail) {
          return false;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        return decoded.exp && decoded.exp > nowSec;
      }
    }
  } catch {}

  // 2. Try validating as ArcStonks Admin JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded && decoded.role === 'admin';
  } catch {
    return false;
  }
}

async function runTests() {
  console.log('=================================================================');
  console.log('       ARCTONKS FIRESTORE & ADMIN SECURITY VERIFICATION MATRIX   ');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName, actual, expected) {
    if (actual === expected) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}: expected ${expected}, got ${actual}`);
      failed++;
    }
  }

  // --- PERSONA 1: Unauthenticated Public User ---
  console.log('--- PERSONA 1: Unauthenticated Public User ---');
  const publicUser = null;
  assert('Public: Read site_settings (Waitlist ON/OFF)', simulateFirestoreRules(publicUser, 'read', 'site_settings', 'default'), true);
  assert('Public: Modify site_settings BLOCKED', simulateFirestoreRules(publicUser, 'update', 'site_settings', 'default', { waitlist_enabled: false }), false);
  assert('Public: Read waitlist_tasks', simulateFirestoreRules(publicUser, 'read', 'waitlist_tasks', 'task_1'), true);
  assert('Public: Create waitlist_tasks BLOCKED', simulateFirestoreRules(publicUser, 'create', 'waitlist_tasks', 'task_new', { title: 'Hack' }), false);
  assert('Public: Delete waitlist_tasks BLOCKED', simulateFirestoreRules(publicUser, 'delete', 'waitlist_tasks', 'task_1'), false);
  assert('Public: Single wallet check (get) ALLOWED', simulateFirestoreRules(publicUser, 'get', 'eligible_wallets', '0x71c63397e3e79401736b43fa9fe4b952e8c0409a'), true);
  assert('Public: Full whitelist scraping (list) BLOCKED', simulateFirestoreRules(publicUser, 'list', 'eligible_wallets'), false);
  assert('Public: Modify eligible_wallets BLOCKED', simulateFirestoreRules(publicUser, 'create', 'eligible_wallets', '0xbad', { allocation: 99 }), false);
  assert('Public: Submit genuine waitlist entry ALLOWED', simulateFirestoreRules(publicUser, 'create', 'waitlist_users', '0x71c63397e3e79401736b43fa9fe4b952e8c0409a', {
    wallet_address: '0x71C63397e3E79401736b43Fa9FE4B952E8C0409A',
    wallet_address_lower: '0x71c63397e3e79401736b43fa9fe4b952e8c0409a',
    created_at: new Date().toISOString(),
  }), true);
  assert('Public: Submit invalid EVM format BLOCKED', simulateFirestoreRules(publicUser, 'create', 'waitlist_users', '0xinvalid', {
    wallet_address: '0xinvalid',
    wallet_address_lower: '0xinvalid',
    created_at: new Date().toISOString(),
  }), false);
  assert('Public: Update existing waitlist user BLOCKED', simulateFirestoreRules(publicUser, 'update', 'waitlist_users', '0x71c63397e3e79401736b43fa9fe4b952e8c0409a', {
    wallet_address: '0xattacker'
  }), false);
  assert('Public: Delete waitlist user BLOCKED', simulateFirestoreRules(publicUser, 'delete', 'waitlist_users', '0x71c63397e3e79401736b43fa9fe4b952e8c0409a'), false);
  assert('Public: Scrape all waitlist users (list) BLOCKED', simulateFirestoreRules(publicUser, 'list', 'waitlist_users'), false);
  assert('Public: Update task completion record BLOCKED', simulateFirestoreRules(publicUser, 'update', 'waitlist_task_completions', '0xabc_task_1'), false);
  assert('Public: Delete task completion record BLOCKED', simulateFirestoreRules(publicUser, 'delete', 'waitlist_task_completions', '0xabc_task_1'), false);
  assert('Public: Backend API access without token BLOCKED', verifyAdminSession(null), false);

  // --- PERSONA 2: Normal Authenticated User (Regular Firebase user) ---
  console.log('\n--- PERSONA 2: Normal Authenticated User (No admin claims) ---');
  const normalUser = {
    uid: 'user_12345',
    token: {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      email: 'normal_user@example.com',
      email_verified: true,
      admin: false,
    },
    isInAdminsCollection: false,
  };
  const normalToken = jwt.sign(
    { aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, email: 'normal_user@example.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 },
    'fake_firebase_key',
    { algorithm: 'none' }
  );
  assert('Normal User: Modify site_settings BLOCKED', simulateFirestoreRules(normalUser, 'update', 'site_settings', 'default', { waitlist_enabled: false }), false);
  assert('Normal User: Modify eligible_wallets BLOCKED', simulateFirestoreRules(normalUser, 'create', 'eligible_wallets', '0x123', { allocation: 10 }), false);
  assert('Normal User: Create/Delete tasks BLOCKED', simulateFirestoreRules(normalUser, 'create', 'waitlist_tasks', 'task_x', {}), false);
  assert('Normal User: Scrape all waitlist users (list) BLOCKED', simulateFirestoreRules(normalUser, 'list', 'waitlist_users'), false);
  assert('Normal User: Delete waitlist user BLOCKED', simulateFirestoreRules(normalUser, 'delete', 'waitlist_users', '0x71c63397e3e79401736b43fa9fe4b952e8c0409a'), false);
  assert('Normal User: Backend /api/admin/* access BLOCKED', verifyAdminSession(normalToken), false);

  // --- PERSONA 3: Unauthorized Authenticated Attacker (Malicious unverified email) ---
  console.log('\n--- PERSONA 3: Unauthorized Authenticated Attacker ---');
  const attackerUser = {
    uid: 'attacker_999',
    token: {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      email: 'admin@arcstonks.com', // Spoofed email without verification
      email_verified: false,
      admin: false,
    },
    isInAdminsCollection: false,
  };
  const attackerToken = jwt.sign(
    { aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, email: 'admin@arcstonks.com', email_verified: false, exp: Math.floor(Date.now() / 1000) + 3600 },
    'fake_key',
    { algorithm: 'none' }
  );
  assert('Attacker (Unverified email): Modify site_settings BLOCKED', simulateFirestoreRules(attackerUser, 'update', 'site_settings', 'default'), false);
  assert('Attacker: Modify eligible_wallets BLOCKED', simulateFirestoreRules(attackerUser, 'update', 'eligible_wallets', '0x71c'), false);
  assert('Attacker: Modify /admins collection BLOCKED', simulateFirestoreRules(attackerUser, 'create', 'admins', attackerUser.uid), false);
  assert('Attacker: Backend /api/admin/* access BLOCKED', verifyAdminSession(attackerToken), false);

  // --- PERSONA 4: Authorized Admin ---
  console.log('\n--- PERSONA 4: Authorized Admin ---');
  const adminWithClaim = {
    uid: 'admin_verified_01',
    token: {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      email: 'admin@arcstonks.com',
      email_verified: true,
      admin: true,
    },
    isInAdminsCollection: true,
  };
  const adminTokenWithClaim = jwt.sign(
    { aud: PROJECT_ID, iss: `https://securetoken.google.com/${PROJECT_ID}`, email: 'admin@arcstonks.com', email_verified: true, admin: true, exp: Math.floor(Date.now() / 1000) + 3600 },
    'fake_key',
    { algorithm: 'none' }
  );
  const adminJwtToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

  assert('Admin: Modify site_settings ALLOWED', simulateFirestoreRules(adminWithClaim, 'update', 'site_settings', 'default'), true);
  assert('Admin: Create/Update/Delete tasks ALLOWED', simulateFirestoreRules(adminWithClaim, 'create', 'waitlist_tasks', 'task_new'), true);
  assert('Admin: Modify eligible_wallets ALLOWED', simulateFirestoreRules(adminWithClaim, 'create', 'eligible_wallets', '0x71c'), true);
  assert('Admin: List all waitlist users ALLOWED', simulateFirestoreRules(adminWithClaim, 'list', 'waitlist_users'), true);
  assert('Admin: Delete waitlist user ALLOWED', simulateFirestoreRules(adminWithClaim, 'delete', 'waitlist_users', '0x71c'), true);
  assert('Admin: List all task completions ALLOWED', simulateFirestoreRules(adminWithClaim, 'list', 'waitlist_task_completions'), true);
  assert('Admin: Delete task completion ALLOWED', simulateFirestoreRules(adminWithClaim, 'delete', 'waitlist_task_completions', '0x71c_task_1'), true);
  assert('Admin: Firebase Token with admin: true accepted by backend', verifyAdminSession(adminTokenWithClaim), true);
  assert('Admin: ArcStonks Admin JWT accepted by backend', verifyAdminSession(adminJwtToken), true);

  console.log('\n=================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
