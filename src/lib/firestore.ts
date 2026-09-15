import { getAdminDb } from './firebaseAdmin';
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

// Collection Names
export const COLLECTIONS = {
  SETTINGS: 'site_settings',
  ELIGIBLE: 'eligible_wallets',
  WAITLIST: 'waitlist_users',
  TASKS: 'waitlist_tasks',
  COMPLETIONS: 'waitlist_task_completions',
  ADMINS: 'admins',
} as const;

/**
 * Normalizes task URLs to valid social endpoints
 */
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

/**
 * Universal helper to check if a document snapshot exists across both Admin and Client SDKs.
 */
function docExists(snap: any): boolean {
  if (!snap) return false;
  if (typeof snap.exists === 'function') return snap.exists();
  return Boolean(snap.exists);
}

// -------------------------------------------------------------
// Site Settings
// -------------------------------------------------------------

export async function getSettingsFirestore(): Promise<{ waitlist_enabled: boolean; checker_enabled: boolean; updated_at: string }> {
  try {
    const db = getAdminDb();
    // Check 'global' first, then 'default' for backward compatibility
    let snap = await db.collection(COLLECTIONS.SETTINGS).doc('global').get();
    if (!docExists(snap)) {
      snap = await db.collection(COLLECTIONS.SETTINGS).doc('default').get();
    }

    if (docExists(snap)) {
      const data = snap.data() || {};
      return {
        waitlist_enabled: data.waitlist_enabled !== undefined ? Boolean(data.waitlist_enabled) : true,
        checker_enabled: data.checker_enabled !== undefined ? Boolean(data.checker_enabled) : true,
        updated_at: data.updated_at || new Date().toISOString(),
      };
    }

    // Default settings if collection is empty (pure read, no side-effect write)
    return {
      waitlist_enabled: true,
      checker_enabled: true,
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[Firestore] Error fetching settings, returning defaults:', err);
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
  const db = getAdminDb();
  const current = await getSettingsFirestore();
  const newWaitlist = waitlist_enabled !== undefined ? Boolean(waitlist_enabled) : current.waitlist_enabled;
  const newChecker = checker_enabled !== undefined ? Boolean(checker_enabled) : current.checker_enabled;
  const now = new Date().toISOString();

  const payload = {
    waitlist_enabled: newWaitlist,
    checker_enabled: newChecker,
    updated_at: now,
  };

  // Persist to both 'global' and 'default' so all readers remain perfectly synchronized
  await db.collection(COLLECTIONS.SETTINGS).doc('global').set(payload, { merge: true });
  await db.collection(COLLECTIONS.SETTINGS).doc('default').set(payload, { merge: true });

  return {
    waitlist_enabled: newWaitlist,
    checker_enabled: newChecker,
  };
}

// -------------------------------------------------------------
// Waitlist Users
// -------------------------------------------------------------

export async function getWaitlistUserByAddressFirestore(rawAddress: string): Promise<WaitlistUser | null> {
  const db = getAdminDb();
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();

  // Check lowercase doc ID first (standard requirement)
  let snap = await db.collection(COLLECTIONS.WAITLIST).doc(addressLower).get();
  if (!docExists(snap)) {
    // Check original address doc ID (legacy fallback)
    snap = await db.collection(COLLECTIONS.WAITLIST).doc(address).get();
  }

  if (!docExists(snap)) {
    return null;
  }

  const data = snap.data() || {};
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
  const db = getAdminDb();
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();
  const cleanHandle = xHandle ? xHandle.trim() : undefined;
  const docRef = db.collection(COLLECTIONS.WAITLIST).doc(addressLower);

  const existing = await docRef.get();
  if (docExists(existing)) {
    const data = existing.data() || {};
    if (cleanHandle && !data.x_handle) {
      await docRef.update({ x_handle: cleanHandle });
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
    wallet_address_lower: addressLower,
    ip_hash: ip_hash || null,
    x_handle: cleanHandle || null,
    created_at: now,
  };

  await docRef.set(newEntry);

  return {
    success: true,
    alreadyExists: false,
    entry: {
      id: addressLower,
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
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.WAITLIST).get();

  let list: WaitlistUser[] = [];
  snap.forEach((d: any) => {
    const data = d.data() || {};
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
  const db = getAdminDb();
  const address = normalizeAddress(idOrAddress);
  const addressLower = address.toLowerCase();

  // Delete both lowercase and checksummed documents if present
  await db.collection(COLLECTIONS.WAITLIST).doc(addressLower).delete();
  if (addressLower !== address) {
    try {
      await db.collection(COLLECTIONS.WAITLIST).doc(address).delete();
    } catch {}
  }

  // Also remove associated completions for this wallet
  try {
    const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
      .where('wallet_address_lower', '==', addressLower)
      .get();
    
    if (!compSnap.empty) {
      const batch = db.batch();
      compSnap.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (compErr) {
    console.warn('[Firestore] Could not cascade delete waitlist completions:', compErr);
  }

  return true;
}

export async function getAllWaitlistAddressesForExportFirestore(): Promise<string[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.WAITLIST).get();
    const list: string[] = [];
    snap.forEach((d: any) => {
      const data = d.data() || {};
      list.push(data.wallet_address || d.id);
    });
    return list;
  } catch (err) {
    console.error('[Firestore] Error fetching waitlist addresses for export:', err);
    return [];
  }
}

export async function getAllWaitlistEntriesForExportFirestore(): Promise<{ wallet_address: string; x_handle?: string; created_at: string }[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.WAITLIST).get();
    const list: { wallet_address: string; x_handle?: string; created_at: string }[] = [];
    snap.forEach((d: any) => {
      const data = d.data() || {};
      list.push({
        wallet_address: data.wallet_address || d.id,
        x_handle: data.x_handle || undefined,
        created_at: data.created_at || '',
      });
    });
    return list;
  } catch (err) {
    console.error('[Firestore] Error fetching waitlist entries for export:', err);
    return [];
  }
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

  const db = getAdminDb();
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();

  // Document ID is lowercase address
  let snap = await db.collection(COLLECTIONS.ELIGIBLE).doc(addressLower).get();
  if (!docExists(snap) && addressLower !== address) {
    snap = await db.collection(COLLECTIONS.ELIGIBLE).doc(address).get();
  }

  if (!docExists(snap)) {
    return {
      address,
      eligible: false,
      message: 'This wallet address is not currently on the eligibility list.',
    };
  }

  const data = snap.data() || {};
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
    allocation: Number(data.allocation) || 1,
    status: data.status || 'active',
    message: `Congratulations! This wallet is eligible for ${data.allocation || 1} allocation(s).`,
  };
}

export async function getEligibleWalletsFirestore(
  search = '',
  limitCount = 50,
  offset = 0
): Promise<{ wallets: EligibleWallet[]; total: number }> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.ELIGIBLE).get();

  let list: EligibleWallet[] = [];
  snap.forEach((d: any) => {
    const data = d.data() || {};
    list.push({
      id: d.id,
      wallet_address: data.wallet_address || d.id,
      allocation: Number(data.allocation) || 1,
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
  const db = getAdminDb();
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();
  const docRef = db.collection(COLLECTIONS.ELIGIBLE).doc(addressLower);
  const now = new Date().toISOString();

  const record = {
    wallet_address: address,
    wallet_address_lower: addressLower,
    allocation: Math.max(1, allocation),
    status: status === 'paused' ? 'paused' : 'active',
    created_at: now,
    updated_at: now,
  };

  await docRef.set(record, { merge: true });
  return { id: addressLower, ...record };
}

export async function updateEligibleWalletFirestore(
  idOrAddress: string,
  allocation?: number,
  status?: string
): Promise<boolean> {
  const db = getAdminDb();
  const address = normalizeAddress(idOrAddress);
  const addressLower = address.toLowerCase();

  let docRef = db.collection(COLLECTIONS.ELIGIBLE).doc(addressLower);
  let snap = await docRef.get();
  if (!docExists(snap)) {
    docRef = db.collection(COLLECTIONS.ELIGIBLE).doc(idOrAddress);
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (allocation !== undefined) updates.allocation = Math.max(1, allocation);
  if (status !== undefined) updates.status = status;

  await docRef.set(updates, { merge: true });
  return true;
}

export async function deleteEligibleWalletFirestore(idOrAddress: string): Promise<boolean> {
  const db = getAdminDb();
  const address = normalizeAddress(idOrAddress);
  const addressLower = address.toLowerCase();

  await db.collection(COLLECTIONS.ELIGIBLE).doc(addressLower).delete();
  if (addressLower !== address) {
    try {
      await db.collection(COLLECTIONS.ELIGIBLE).doc(address).delete();
    } catch {}
  }
  return true;
}

export async function importEligibleWalletsFirestore(
  entries: { address: string; allocation?: number }[]
): Promise<ImportResult> {
  const db = getAdminDb();
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
  let batch = db.batch();
  let batchOps = 0;
  const now = new Date().toISOString();

  // Pre-fetch existing addresses
  const existingSnap = await db.collection(COLLECTIONS.ELIGIBLE).get();
  const existingSet = new Set<string>();
  existingSnap.forEach((d: any) => {
    existingSet.add(d.id.toLowerCase());
    const data = d.data() || {};
    if (data.wallet_address_lower) existingSet.add(data.wallet_address_lower);
  });

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

    const docRef = db.collection(COLLECTIONS.ELIGIBLE).doc(lower);
    batch.set(docRef, {
      wallet_address: normalized,
      wallet_address_lower: lower,
      allocation: alloc,
      status: 'active',
      created_at: now,
      updated_at: now,
    }, { merge: true });
    batchOps++;

    result.successfulCount++;
    result.successful.push({ address: normalized, allocation: alloc });

    if (batchOps >= 400) {
      await batch.commit();
      batch = db.batch();
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

/**
 * Public community tasks loader.
 * CRITICAL: Strictly read-only. Never performs unauthenticated auto-bootstrapping writes.
 * If zero tasks exist in Firestore, cleanly returns an empty array.
 */
export async function getPublicTasksFirestore(rawAddress?: string): Promise<PublicTaskItem[]> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.TASKS).get();

  let tasks: WaitlistTask[] = [];
  snap.forEach((d: any) => {
    const data = d.data() || {};
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

  // Sort by display_order ascending
  tasks.sort((a, b) => a.display_order - b.display_order);

  // Enrich with user completions if a valid wallet address was provided
  const completionMap = new Map<string, { verified_at: string; proof_value?: string }>();
  if (rawAddress && isValidEvmAddress(rawAddress)) {
    const addressLower = normalizeAddress(rawAddress).toLowerCase();
    try {
      const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
        .where('wallet_address_lower', '==', addressLower)
        .get();

      compSnap.forEach((d: any) => {
        const data = d.data() || {};
        if (data.task_id) {
          completionMap.set(String(data.task_id), {
            verified_at: data.verified_at || '',
            proof_value: data.proof_value || undefined,
          });
        }
      });
    } catch (compErr) {
      console.warn('[Firestore] Error fetching completions for address:', compErr);
    }
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
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.TASKS).get();

  let tasks: WaitlistTask[] = [];
  snap.forEach((d: any) => {
    const data = d.data() || {};
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

  // Compute completion counts
  try {
    const compSnap = await db.collection(COLLECTIONS.COMPLETIONS).get();
    const countMap = new Map<string, number>();
    compSnap.forEach((d: any) => {
      const data = d.data() || {};
      const tid = String(data.task_id || '');
      if (tid) countMap.set(tid, (countMap.get(tid) || 0) + 1);
    });
    tasks.forEach((t: any) => {
      t.completionCount = countMap.get(String(t.id)) || 0;
    });
  } catch (err) {
    console.warn('[Firestore] Could not aggregate task completion counts:', err);
  }

  return tasks;
}

export async function getTaskCompletionsFirestore(
  taskId: string | number,
  limit = 50
): Promise<{ id: string | number; wallet_address: string; proof_value?: string; verified_at: string }[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.COMPLETIONS)
      .where('task_id', '==', String(taskId))
      .get();
    const list: { id: string | number; wallet_address: string; proof_value?: string; verified_at: string }[] = [];
    snap.forEach((d: any) => {
      const data = d.data() || {};
      list.push({
        id: d.id,
        wallet_address: data.wallet_address || '',
        proof_value: data.proof_value || undefined,
        verified_at: data.verified_at || '',
      });
    });
    return list.slice(0, limit);
  } catch (err) {
    console.error('[Firestore] Error getting task completions:', err);
    return [];
  }
}

export async function createTaskFirestore(data: {
  title: string;
  type: string;
  url: string;
  required?: boolean;
  enabled?: boolean;
  display_order?: number;
}): Promise<WaitlistTask> {
  const db = getAdminDb();
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();
  const docRef = db.collection(COLLECTIONS.TASKS).doc(taskId);

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

  await docRef.set(clean);
  return { id: taskId, ...clean, completionCount: 0 };
}

export async function updateTaskFirestore(
  id: string | number,
  data: Partial<WaitlistTask>
): Promise<boolean> {
  const db = getAdminDb();
  const docRef = db.collection(COLLECTIONS.TASKS).doc(String(id));
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.type !== undefined) updates.type = data.type.trim();
  if (data.url !== undefined) updates.url = formatTaskUrl(data.url);
  if (data.required !== undefined) updates.required = Boolean(data.required);
  if (data.enabled !== undefined) updates.enabled = Boolean(data.enabled);
  if (data.display_order !== undefined) updates.display_order = Number(data.display_order);

  await docRef.set(updates, { merge: true });
  return true;
}

export async function deleteTaskFirestore(id: string | number): Promise<boolean> {
  const db = getAdminDb();
  const taskId = String(id);
  await db.collection(COLLECTIONS.TASKS).doc(taskId).delete();

  // Cascade remove completions for this task
  try {
    const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
      .where('task_id', '==', taskId)
      .get();
    
    if (!compSnap.empty) {
      const batch = db.batch();
      compSnap.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('[Firestore] Could not cascade delete task completions:', err);
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

  const db = getAdminDb();
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();
  const tid = String(taskId);

  // Check if task exists and enabled
  const taskSnap = await db.collection(COLLECTIONS.TASKS).doc(tid).get();
  if (!docExists(taskSnap)) {
    return { success: false, error: 'Task not found' };
  }
  const taskData = taskSnap.data() || {};
  if (taskData.enabled === false) {
    return { success: false, error: 'Task is disabled' };
  }

  const cleanProof = proofValue ? proofValue.trim() : null;
  const completionId = `${addressLower}_${tid}`;
  const docRef = db.collection(COLLECTIONS.COMPLETIONS).doc(completionId);
  const now = new Date().toISOString();

  await docRef.set(
    {
      wallet_address: address,
      wallet_address_lower: addressLower,
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
  const db = getAdminDb();
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();

  // 1. Get all enabled & required tasks
  const tasksSnap = await db.collection(COLLECTIONS.TASKS).get();
  const requiredTasks: { id: string; title: string }[] = [];

  tasksSnap.forEach((d: any) => {
    const data = d.data() || {};
    if (data.enabled !== false && Boolean(data.required)) {
      requiredTasks.push({ id: d.id, title: data.title || '' });
    }
  });

  if (requiredTasks.length === 0) {
    return { allCompleted: true, missingTasks: [], requiredTotal: 0, completedRequired: 0 };
  }

  // 2. Get completed tasks for this wallet
  const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
    .where('wallet_address_lower', '==', addressLower)
    .get();

  const completedIds = new Set<string>();
  compSnap.forEach((d: any) => {
    const data = d.data() || {};
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

  const db = getAdminDb();
  const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
    .where('task_id', '==', String(taskId))
    .get();

  const currentLower = normalizeAddress(currentAddress).toLowerCase();
  for (const d of compSnap.docs) {
    const data = d.data() || {};
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
  const db = getAdminDb();

  // Settings
  const settings = await getSettingsFirestore();

  // Waitlist count
  const waitlistSnap = await db.collection(COLLECTIONS.WAITLIST).get();
  const totalWaitlist = waitlistSnap.size;

  // Eligible count & allocations
  const eligibleSnap = await db.collection(COLLECTIONS.ELIGIBLE).get();
  const totalEligible = eligibleSnap.size;
  let totalAllocation = 0;
  eligibleSnap.forEach((d: any) => {
    const data = d.data() || {};
    totalAllocation += Number(data.allocation || 1);
  });

  // Tasks & completions
  const tasksSnap = await db.collection(COLLECTIONS.TASKS).get();
  const totalTasks = tasksSnap.size;

  const compSnap = await db.collection(COLLECTIONS.COMPLETIONS).get();
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
