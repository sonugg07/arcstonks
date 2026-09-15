import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import {
  SiteSettings,
  WaitlistUser,
  EligibleWallet,
  AdminStats,
  ImportResult,
  WaitlistTask,
  PublicTaskItem
} from './types';
import { normalizeAddress, isValidEvmAddress } from './validation';

// Collection Names (as requested by user)
export const COLLECTIONS = {
  SETTINGS: 'site_settings',
  ELIGIBLE: 'eligible_wallets',
  WAITLIST: 'waitlist_users',
  TASKS: 'waitlist_tasks',
  COMPLETIONS: 'waitlist_task_completions',
} as const;

function formatTaskUrl(url?: string): string {
  if (!url || !url.trim()) return 'https://x.com/arcstonks';
  let clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  if (clean.includes('123456789') || clean.includes('bytewave01') || clean.includes('twitter.com/ArcStonks')) {
    return 'https://x.com/arcstonks';
  }
  return clean;
}

// -------------------------------------------------------------
// Site Settings
// -------------------------------------------------------------

export async function getSettingsFirestore(): Promise<{ waitlist_enabled: boolean; checker_enabled: boolean; updated_at: string }> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'default');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        waitlist_enabled: data.waitlist_enabled !== undefined ? Boolean(data.waitlist_enabled) : true,
        checker_enabled: data.checker_enabled !== undefined ? Boolean(data.checker_enabled) : true,
        updated_at: data.updated_at || new Date().toISOString(),
      };
    }

    // Default settings if not yet created in Firestore
    const defaults = {
      waitlist_enabled: true,
      checker_enabled: true,
      updated_at: new Date().toISOString(),
    };
    await setDoc(docRef, defaults, { merge: true });
    return defaults;
  } catch (err) {
    console.warn('Error fetching settings from Firestore, returning defaults:', err);
    return {
      waitlist_enabled: true,
      checker_enabled: true,
      updated_at: new Date().toISOString(),
    };
  }
}

export async function updateSettingsFirestore(
  waitlist_enabled?: boolean,
  checker_enabled?: boolean
): Promise<{ waitlist_enabled: boolean; checker_enabled: boolean }> {
  const db = getFirebaseDb();
  const current = await getSettingsFirestore();
  const newWaitlist = waitlist_enabled !== undefined ? Boolean(waitlist_enabled) : current.waitlist_enabled;
  const newChecker = checker_enabled !== undefined ? Boolean(checker_enabled) : current.checker_enabled;
  const now = new Date().toISOString();

  const docRef = doc(db, COLLECTIONS.SETTINGS, 'default');
  await setDoc(
    docRef,
    {
      waitlist_enabled: newWaitlist,
      checker_enabled: newChecker,
      updated_at: now,
    },
    { merge: true }
  );

  return {
    waitlist_enabled: newWaitlist,
    checker_enabled: newChecker,
  };
}

// -------------------------------------------------------------
// Waitlist Users
// -------------------------------------------------------------

export async function getWaitlistUserByAddressFirestore(rawAddress: string): Promise<WaitlistUser | null> {
  const db = getFirebaseDb();
  const address = normalizeAddress(rawAddress);
  const docRef = doc(db, COLLECTIONS.WAITLIST, address);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();
  return {
    id: snap.id,
    wallet_address: data.wallet_address || address,
    created_at: data.created_at || new Date().toISOString(),
    ip_hash: data.ip_hash || undefined,
    x_handle: data.x_handle || undefined,
  };
}

export async function addWaitlistUserFirestore(
  rawAddress: string,
  ip_hash?: string,
  xHandle?: string
): Promise<{ success: boolean; alreadyExists: boolean; entry?: WaitlistUser }> {
  const db = getFirebaseDb();
  const address = normalizeAddress(rawAddress);
  const cleanHandle = xHandle ? xHandle.trim() : undefined;
  const docRef = doc(db, COLLECTIONS.WAITLIST, address);

  const existing = await getDoc(docRef);
  if (existing.exists()) {
    const data = existing.data();
    if (cleanHandle && !data.x_handle) {
      await updateDoc(docRef, { x_handle: cleanHandle });
      data.x_handle = cleanHandle;
    }
    return {
      success: true,
      alreadyExists: true,
      entry: {
        id: existing.id,
        wallet_address: data.wallet_address || address,
        created_at: data.created_at || new Date().toISOString(),
        ip_hash: data.ip_hash || undefined,
        x_handle: data.x_handle || undefined,
      },
    };
  }

  const now = new Date().toISOString();
  const newEntry = {
    wallet_address: address,
    wallet_address_lower: address.toLowerCase(),
    ip_hash: ip_hash || null,
    x_handle: cleanHandle || null,
    created_at: now,
  };

  await setDoc(docRef, newEntry);

  return {
    success: true,
    alreadyExists: false,
    entry: {
      id: address,
      wallet_address: address,
      created_at: now,
      ip_hash,
      x_handle: cleanHandle,
    },
  };
}

export async function getWaitlistUsersFirestore(
  search = '',
  limitCount = 50,
  offset = 0
): Promise<{ users: WaitlistUser[]; total: number }> {
  const db = getFirebaseDb();
  const colRef = collection(db, COLLECTIONS.WAITLIST);
  const snap = await getDocs(colRef);

  let list: WaitlistUser[] = [];
  snap.forEach(d => {
    const data = d.data();
    list.push({
      id: d.id,
      wallet_address: data.wallet_address || d.id,
      created_at: data.created_at || '',
      ip_hash: data.ip_hash || undefined,
      x_handle: data.x_handle || undefined,
    });
  });

  // Sort by created_at desc
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  // Filter if search provided
  if (search.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter(
      u =>
        u.wallet_address.toLowerCase().includes(term) ||
        (u.x_handle && u.x_handle.toLowerCase().includes(term))
    );
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limitCount);
  return { users: paginated, total };
}

export async function deleteWaitlistUserFirestore(idOrAddress: string): Promise<boolean> {
  const db = getFirebaseDb();
  const address = normalizeAddress(idOrAddress);
  const docRef = doc(db, COLLECTIONS.WAITLIST, address);

  // Delete user doc
  await deleteDoc(docRef);

  // Also remove associated completions
  try {
    const compCol = collection(db, COLLECTIONS.COMPLETIONS);
    const q = query(compCol, where('wallet_address_lower', '==', address.toLowerCase()));
    const compSnap = await getDocs(q);
    const batch = writeBatch(db);
    compSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (compErr) {
    console.warn('Could not cascade delete waitlist completions:', compErr);
  }

  return true;
}

// -------------------------------------------------------------
// Eligible Wallets
// -------------------------------------------------------------

export async function isWalletEligibleFirestore(
  rawAddress: string
): Promise<{ address: string; eligible: boolean; allocation?: number; status?: string; message?: string }> {
  if (!isValidEvmAddress(rawAddress)) {
    return { address: rawAddress, eligible: false, message: 'Invalid EVM wallet address format.' };
  }

  const db = getFirebaseDb();
  const address = normalizeAddress(rawAddress);
  const docRef = doc(db, COLLECTIONS.ELIGIBLE, address);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return {
      address,
      eligible: false,
      message: 'This wallet address is not currently on the eligibility list.',
    };
  }

  const data = snap.data();
  if (data.status === 'paused') {
    return {
      address,
      eligible: false,
      status: 'paused',
      message: 'Eligibility allocation for this wallet is currently paused.',
    };
  }

  return {
    address,
    eligible: true,
    allocation: data.allocation || 1,
    status: data.status || 'active',
    message: `Congratulations! This wallet is eligible for ${data.allocation || 1} NFT(s).`,
  };
}

export async function getEligibleWalletsFirestore(
  search = '',
  limitCount = 50,
  offset = 0
): Promise<{ wallets: EligibleWallet[]; total: number }> {
  const db = getFirebaseDb();
  const colRef = collection(db, COLLECTIONS.ELIGIBLE);
  const snap = await getDocs(colRef);

  let list: EligibleWallet[] = [];
  snap.forEach(d => {
    const data = d.data();
    list.push({
      id: d.id,
      wallet_address: data.wallet_address || d.id,
      allocation: data.allocation || 1,
      status: data.status || 'active',
      created_at: data.created_at || '',
      updated_at: data.updated_at || '',
    });
  });

  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  if (search.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter(w => w.wallet_address.toLowerCase().includes(term));
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limitCount);
  return { wallets: paginated, total };
}

export async function addEligibleWalletFirestore(
  rawAddress: string,
  allocation = 1,
  status = 'active'
): Promise<EligibleWallet> {
  const db = getFirebaseDb();
  const address = normalizeAddress(rawAddress);
  const docRef = doc(db, COLLECTIONS.ELIGIBLE, address);
  const now = new Date().toISOString();

  const record = {
    wallet_address: address,
    wallet_address_lower: address.toLowerCase(),
    allocation: Math.max(1, allocation),
    status: status === 'paused' ? 'paused' : 'active',
    created_at: now,
    updated_at: now,
  };

  await setDoc(docRef, record, { merge: true });
  return { id: address, ...record };
}

export async function updateEligibleWalletFirestore(
  idOrAddress: string,
  allocation?: number,
  status?: string
): Promise<boolean> {
  const db = getFirebaseDb();
  const address = normalizeAddress(idOrAddress);
  const docRef = doc(db, COLLECTIONS.ELIGIBLE, address);
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (allocation !== undefined) updates.allocation = Math.max(1, allocation);
  if (status !== undefined) updates.status = status;

  await updateDoc(docRef, updates);
  return true;
}

export async function deleteEligibleWalletFirestore(idOrAddress: string): Promise<boolean> {
  const db = getFirebaseDb();
  const address = normalizeAddress(idOrAddress);
  const docRef = doc(db, COLLECTIONS.ELIGIBLE, address);
  await deleteDoc(docRef);
  return true;
}

export async function importEligibleWalletsFirestore(
  entries: { address: string; allocation?: number }[]
): Promise<ImportResult> {
  const db = getFirebaseDb();
  const result: ImportResult = {
    totalProcessed: entries.length,
    successfulCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    successful: [],
    invalid: [],
    duplicates: [],
  };

  const seenInBatch = new Set<string>();
  const batch = writeBatch(db);
  let batchOps = 0;
  const now = new Date().toISOString();

  // Pre-fetch existing addresses
  const existingSnap = await getDocs(collection(db, COLLECTIONS.ELIGIBLE));
  const existingSet = new Set<string>();
  existingSnap.forEach(d => existingSet.add(d.id.toLowerCase()));

  for (const entry of entries) {
    const raw = (entry.address || '').trim();
    if (!isValidEvmAddress(raw)) {
      result.invalidCount++;
      result.invalid.push({ address: raw, reason: 'Invalid EVM format' });
      continue;
    }

    const normalized = normalizeAddress(raw);
    const lower = normalized.toLowerCase();

    if (existingSet.has(lower) || seenInBatch.has(lower)) {
      result.duplicateCount++;
      result.duplicates.push(normalized);
      continue;
    }

    seenInBatch.add(lower);
    const alloc = Math.max(1, parseInt(String(entry.allocation || 1), 10) || 1);

    const docRef = doc(db, COLLECTIONS.ELIGIBLE, normalized);
    batch.set(docRef, {
      wallet_address: normalized,
      wallet_address_lower: lower,
      allocation: alloc,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    batchOps++;

    result.successfulCount++;
    result.successful.push({ address: normalized, allocation: alloc });

    if (batchOps >= 450) {
      await batch.commit();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  return result;
}

// -------------------------------------------------------------
// Tasks & Task Completions
// -------------------------------------------------------------

export async function getPublicTasksFirestore(rawAddress?: string): Promise<PublicTaskItem[]> {
  const db = getFirebaseDb();
  const colRef = collection(db, COLLECTIONS.TASKS);
  const snap = await getDocs(colRef);

  let tasks: WaitlistTask[] = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.enabled !== false && data.enabled !== 0) {
      tasks.push({
        id: d.id,
        title: data.title || '',
        type: data.type || 'Custom',
        url: formatTaskUrl(data.url),
        required: Boolean(data.required),
        enabled: Boolean(data.enabled),
        display_order: Number(data.display_order || 0),
        created_at: data.created_at || '',
        updated_at: data.updated_at || '',
      });
    }
  });

  // Sort by display_order
  tasks.sort((a, b) => a.display_order - b.display_order);

  // If tasks are empty in Firestore, auto-bootstrap the 4 verified tasks
  if (tasks.length === 0) {
    const bootstrap = [
      { id: 'task_1', title: 'Follow ArcStonks on X', type: 'Follow', url: 'https://x.com/arcstonks', required: true, enabled: true, display_order: 1 },
      { id: 'task_2', title: 'Like our announcement', type: 'Like', url: 'https://x.com/arcstonks', required: true, enabled: true, display_order: 2 },
      { id: 'task_3', title: 'Repost our announcement', type: 'Repost', url: 'https://x.com/arcstonks', required: true, enabled: true, display_order: 3 },
      { id: 'task_4', title: 'Comment on our announcement', type: 'Comment', url: 'https://x.com/arcstonks', required: true, enabled: true, display_order: 4 },
    ];
    for (const t of bootstrap) {
      const docRef = doc(db, COLLECTIONS.TASKS, t.id);
      await setDoc(docRef, { ...t, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      tasks.push(t as any);
    }
  }

  // Enrich with completions if wallet provided
  const completionMap = new Map<string, { verified_at: string; proof_value?: string }>();
  if (rawAddress && isValidEvmAddress(rawAddress)) {
    const addressLower = normalizeAddress(rawAddress).toLowerCase();
    const compCol = collection(db, COLLECTIONS.COMPLETIONS);
    const q = query(compCol, where('wallet_address_lower', '==', addressLower));
    const compSnap = await getDocs(q);
    compSnap.forEach(d => {
      const data = d.data();
      if (data.task_id) {
        completionMap.set(String(data.task_id), {
          verified_at: data.verified_at || '',
          proof_value: data.proof_value || undefined,
        });
      }
    });
  }

  return tasks.map(t => {
    const comp = completionMap.get(String(t.id));
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      url: t.url,
      required: Boolean(t.required),
      enabled: Boolean(t.enabled),
      display_order: t.display_order,
      completed: Boolean(comp),
      verified_at: comp?.verified_at,
      proof_value: comp?.proof_value,
    };
  });
}

export async function getAllTasksAdminFirestore(): Promise<WaitlistTask[]> {
  const db = getFirebaseDb();
  const colRef = collection(db, COLLECTIONS.TASKS);
  const snap = await getDocs(colRef);

  let tasks: WaitlistTask[] = [];
  snap.forEach(d => {
    const data = d.data();
    tasks.push({
      id: d.id,
      title: data.title || '',
      type: data.type || 'Custom',
      url: formatTaskUrl(data.url),
      required: Boolean(data.required),
      enabled: Boolean(data.enabled),
      display_order: Number(data.display_order || 0),
      created_at: data.created_at || '',
      updated_at: data.updated_at || '',
      completionCount: 0,
    });
  });

  tasks.sort((a, b) => a.display_order - b.display_order);

  // Get completion counts
  try {
    const compSnap = await getDocs(collection(db, COLLECTIONS.COMPLETIONS));
    const countMap = new Map<string, number>();
    compSnap.forEach(d => {
      const tid = String(d.data().task_id || '');
      countMap.set(tid, (countMap.get(tid) || 0) + 1);
    });
    tasks.forEach(t => {
      t.completionCount = countMap.get(String(t.id)) || 0;
    });
  } catch (err) {
    console.warn('Could not aggregate task completion counts:', err);
  }

  return tasks;
}

export async function createTaskFirestore(data: {
  title: string;
  type: string;
  url: string;
  required?: boolean;
  enabled?: boolean;
  display_order?: number;
}): Promise<WaitlistTask> {
  const db = getFirebaseDb();
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();
  const docRef = doc(db, COLLECTIONS.TASKS, taskId);

  const clean = {
    title: data.title.trim(),
    type: data.type.trim(),
    url: formatTaskUrl(data.url),
    required: data.required !== undefined ? Boolean(data.required) : true,
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
    display_order: Number(data.display_order || 0),
    created_at: now,
    updated_at: now,
  };

  await setDoc(docRef, clean);
  return { id: taskId, ...clean, completionCount: 0 };
}

export async function updateTaskFirestore(
  id: string | number,
  data: Partial<WaitlistTask>
): Promise<boolean> {
  const db = getFirebaseDb();
  const docRef = doc(db, COLLECTIONS.TASKS, String(id));
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.type !== undefined) updates.type = data.type.trim();
  if (data.url !== undefined) updates.url = formatTaskUrl(data.url);
  if (data.required !== undefined) updates.required = Boolean(data.required);
  if (data.enabled !== undefined) updates.enabled = Boolean(data.enabled);
  if (data.display_order !== undefined) updates.display_order = Number(data.display_order);

  await updateDoc(docRef, updates);
  return true;
}

export async function deleteTaskFirestore(id: string | number): Promise<boolean> {
  const db = getFirebaseDb();
  const docRef = doc(db, COLLECTIONS.TASKS, String(id));
  await deleteDoc(docRef);

  // Remove completions for this task
  try {
    const compCol = collection(db, COLLECTIONS.COMPLETIONS);
    const q = query(compCol, where('task_id', '==', String(id)));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Could not cascade delete task completions:', err);
  }

  return true;
}

export async function verifyTaskCompletionFirestore(
  rawAddress: string,
  taskId: string | number,
  proofValue?: string
): Promise<{ success: boolean; error?: string; verifiedAt?: string; proofValue?: string }> {
  if (!isValidEvmAddress(rawAddress)) {
    return { success: false, error: 'Invalid EVM address format' };
  }

  const db = getFirebaseDb();
  const address = normalizeAddress(rawAddress);
  const tid = String(taskId);

  // Check if task exists and enabled
  const taskDoc = await getDoc(doc(db, COLLECTIONS.TASKS, tid));
  if (!taskDoc.exists() || taskDoc.data().enabled === false) {
    return { success: false, error: 'Task not found or disabled' };
  }

  const cleanProof = proofValue ? proofValue.trim() : null;
  const completionId = `${address.toLowerCase()}_${tid}`;
  const docRef = doc(db, COLLECTIONS.COMPLETIONS, completionId);
  const now = new Date().toISOString();

  await setDoc(
    docRef,
    {
      wallet_address: address,
      wallet_address_lower: address.toLowerCase(),
      task_id: tid,
      status: 'completed',
      proof_value: cleanProof,
      verified_at: now,
      created_at: now,
    },
    { merge: true }
  );

  return { success: true, verifiedAt: now, proofValue: cleanProof || undefined };
}

export async function checkRequiredTasksCompletedFirestore(
  rawAddress: string
): Promise<{ allCompleted: boolean; missingTasks: string[]; requiredTotal: number; completedRequired: number }> {
  const db = getFirebaseDb();
  const address = normalizeAddress(rawAddress);

  // 1. Get enabled & required tasks
  const tasksCol = collection(db, COLLECTIONS.TASKS);
  const tasksSnap = await getDocs(tasksCol);
  const requiredTasks: { id: string; title: string }[] = [];

  tasksSnap.forEach(d => {
    const data = d.data();
    if (data.enabled !== false && Boolean(data.required)) {
      requiredTasks.push({ id: d.id, title: data.title || '' });
    }
  });

  if (requiredTasks.length === 0) {
    return { allCompleted: true, missingTasks: [], requiredTotal: 0, completedRequired: 0 };
  }

  // 2. Get completed tasks for wallet
  const compCol = collection(db, COLLECTIONS.COMPLETIONS);
  const q = query(compCol, where('wallet_address_lower', '==', address.toLowerCase()));
  const compSnap = await getDocs(q);
  const completedIds = new Set<string>();
  compSnap.forEach(d => {
    const data = d.data();
    if (data.task_id) completedIds.add(String(data.task_id));
  });

  const missingTasks: string[] = [];
  let completedRequired = 0;

  for (const t of requiredTasks) {
    if (completedIds.has(t.id)) {
      completedRequired++;
    } else {
      missingTasks.push(t.title);
    }
  }

  return {
    allCompleted: missingTasks.length === 0,
    missingTasks,
    requiredTotal: requiredTasks.length,
    completedRequired,
  };
}

export async function isProofUsedByAnotherWalletFirestore(
  proofValue: string,
  taskId: string | number,
  currentAddress: string
): Promise<boolean> {
  const clean = proofValue.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return false;

  const db = getFirebaseDb();
  const compCol = collection(db, COLLECTIONS.COMPLETIONS);
  const q = query(compCol, where('task_id', '==', String(taskId)));
  const snap = await getDocs(q);

  const currentLower = normalizeAddress(currentAddress).toLowerCase();
  for (const d of snap.docs) {
    const data = d.data();
    const storedProof = (data.proof_value || '').trim().toLowerCase().replace(/^@/, '');
    if (storedProof === clean && data.wallet_address_lower !== currentLower) {
      return true;
    }
  }

  return false;
}

// -------------------------------------------------------------
// Admin Stats
// -------------------------------------------------------------

export async function getAdminStatsFirestore(): Promise<AdminStats> {
  const db = getFirebaseDb();

  // Settings
  const settings = await getSettingsFirestore();

  // Waitlist count
  const waitlistSnap = await getDocs(collection(db, COLLECTIONS.WAITLIST));
  const totalWaitlist = waitlistSnap.size;

  // Eligible count & allocations
  const eligibleSnap = await getDocs(collection(db, COLLECTIONS.ELIGIBLE));
  const totalEligible = eligibleSnap.size;
  let totalAllocation = 0;
  eligibleSnap.forEach(d => {
    totalAllocation += Number(d.data().allocation || 1);
  });

  // Tasks & completions
  const tasksSnap = await getDocs(collection(db, COLLECTIONS.TASKS));
  const totalTasks = tasksSnap.size;

  const compSnap = await getDocs(collection(db, COLLECTIONS.COMPLETIONS));
  const totalCompletions = compSnap.size;

  return {
    totalWaitlist,
    totalEligible,
    totalAllocation,
    waitlistEnabled: settings.waitlist_enabled,
    checkerEnabled: settings.checker_enabled,
    totalTasks,
    totalCompletions,
  };
}
