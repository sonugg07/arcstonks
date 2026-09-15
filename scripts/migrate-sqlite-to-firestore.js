/**
 * ArcStonks SQLite to Firestore Data Migration Script
 * 
 * Extracts all data from arcstonks.db (SQLite) and:
 * 1. Generates a standalone JSON backup file: scripts/sqlite-backup.json
 * 2. Uploads all records into Firebase Firestore collections:
 *    - site_settings
 *    - waitlist_users
 *    - eligible_wallets
 *    - waitlist_tasks
 *    - waitlist_task_completions
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function migrate() {
  console.log('=== STARTING SQLITE TO FIRESTORE MIGRATION ===\n');

  const dbPath = path.join(__dirname, '..', 'arcstonks.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Error: arcstonks.db not found at', dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  // 1. Read existing SQLite records
  console.log('1. Reading SQLite records...');
  const settings = db.prepare('SELECT * FROM site_settings WHERE id = 1').get() || { waitlist_enabled: 1, checker_enabled: 1 };
  const users = db.prepare('SELECT * FROM waitlist_users').all();
  const eligible = db.prepare('SELECT * FROM eligible_wallets').all();
  const tasks = db.prepare('SELECT * FROM waitlist_tasks').all();
  const completions = db.prepare('SELECT * FROM waitlist_task_completions').all();

  console.log(`- Settings: 1`);
  console.log(`- Waitlist Users: ${users.length}`);
  console.log(`- Eligible Wallets: ${eligible.length}`);
  console.log(`- Waitlist Tasks: ${tasks.length}`);
  console.log(`- Task Completions: ${completions.length}`);

  // 2. Save standalone JSON backup
  const backup = {
    migratedAt: new Date().toISOString(),
    settings,
    users,
    eligible,
    tasks,
    completions,
  };

  const backupPath = path.join(__dirname, 'sqlite-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`\n2. SQLite data successfully backed up to ${backupPath}`);

  // 3. Connect to Firebase
  console.log('\n3. Connecting to Firebase Firestore...');
  try {
    const { initializeApp, getApps } = require('firebase/app');
    const { getFirestore, doc, setDoc, writeBatch, collection } = require('firebase/firestore');

    // Read config from environment or .env.local
    let apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
    let projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'arcstonks';

    if (!apiKey && fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
      const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
      const match = envContent.match(/(?:VITE|NEXT_PUBLIC_)?FIREBASE_API_KEY=([^\r\n]+)/);
      if (match && match[1]) apiKey = match[1].trim();
    }

    if (!apiKey) {
      console.log('NOTE: Firebase API Key not found in environment. Backup JSON created. To upload to Firestore, set VITE_FIREBASE_API_KEY and rerun: node scripts/migrate-sqlite-to-firestore.js');
      return;
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp({
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.appspot.com`,
    });

    const firestore = getFirestore(app);

    // 4. Upload Settings
    console.log('4. Uploading site_settings to Firestore...');
    await setDoc(doc(firestore, 'site_settings', 'default'), {
      waitlist_enabled: Boolean(settings.waitlist_enabled),
      checker_enabled: Boolean(settings.checker_enabled),
      updated_at: settings.updated_at || new Date().toISOString(),
    }, { merge: true });

    // 5. Upload Waitlist Tasks
    console.log('5. Uploading waitlist_tasks to Firestore...');
    for (const t of tasks) {
      await setDoc(doc(firestore, 'waitlist_tasks', `task_${t.id}`), {
        title: t.title,
        type: t.type,
        url: t.url,
        required: Boolean(t.required),
        enabled: Boolean(t.enabled),
        display_order: t.display_order,
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
      }, { merge: true });
    }

    // 6. Upload Eligible Wallets in Batches
    console.log(`6. Uploading ${eligible.length} eligible_wallets to Firestore...`);
    let batch = writeBatch(firestore);
    let count = 0;
    for (const w of eligible) {
      const addr = w.wallet_address.toLowerCase();
      const ref = doc(firestore, 'eligible_wallets', addr);
      batch.set(ref, {
        wallet_address: w.wallet_address,
        wallet_address_lower: addr,
        allocation: w.allocation || 1,
        status: w.status || 'active',
        created_at: w.created_at || new Date().toISOString(),
        updated_at: w.updated_at || new Date().toISOString(),
      }, { merge: true });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(firestore);
      }
    }
    await batch.commit();

    // 7. Upload Waitlist Users in Batches
    console.log(`7. Uploading ${users.length} waitlist_users to Firestore...`);
    batch = writeBatch(firestore);
    count = 0;
    for (const u of users) {
      const addr = u.wallet_address.toLowerCase();
      const ref = doc(firestore, 'waitlist_users', addr);
      batch.set(ref, {
        wallet_address: u.wallet_address,
        wallet_address_lower: addr,
        ip_hash: u.ip_hash || null,
        x_handle: u.x_handle || null,
        created_at: u.created_at || new Date().toISOString(),
      }, { merge: true });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(firestore);
      }
    }
    await batch.commit();

    // 8. Upload Completions in Batches
    console.log(`8. Uploading ${completions.length} task completions to Firestore...`);
    batch = writeBatch(firestore);
    count = 0;
    for (const c of completions) {
      const addr = c.wallet_address.toLowerCase();
      const ref = doc(firestore, 'waitlist_task_completions', `${addr}_${c.task_id}`);
      batch.set(ref, {
        wallet_address: c.wallet_address,
        wallet_address_lower: addr,
        task_id: `task_${c.task_id}`,
        status: 'completed',
        proof_value: c.proof_value || null,
        verified_at: c.verified_at || new Date().toISOString(),
        created_at: c.created_at || new Date().toISOString(),
      }, { merge: true });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(firestore);
      }
    }
    await batch.commit();

    console.log('\n=== FIRESTORE MIGRATION COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

migrate();
