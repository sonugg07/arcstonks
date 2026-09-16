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

  try {
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
  } catch (err: any) {
    console.warn('[Firestore] Error in isWalletEligibleFirestore:', err.message);
    const address = normalizeAddress(rawAddress);
    return {
      address,
      eligible: false,
      message: 'Eligibility verification service is temporarily busy. Please check back shortly.',
    };
  }
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
// -------------------------------------------------------------
// Tasks & Task Completions
// -------------------------------------------------------------

/**
 * Default community tasks for fallback and initial state
 */
export const DEFAULT_COMMUNITY_TASKS: WaitlistTask[] = [
  {
    id: 'task_1',
    title: 'Follow ArcStonks on X',
    type: 'Follow',
    url: 'https://x.com/arcstonks',
    required: true,
    enabled: true,
    display_order: 1,
    created_at: '2026-09-06T14:48:29.000Z',
    updated_at: '2026-09-07T04:39:39.000Z',
  },
  {
    id: 'task_2',
    title: 'Like our announcement',
    type: 'Like',
    url: 'https://x.com/arcstonks',
    required: true,
    enabled: true,
    display_order: 2,
    created_at: '2026-09-06T14:48:29.000Z',
    updated_at: '2026-09-07T04:39:22.000Z',
  },
  {
    id: 'task_3',
    title: 'Repost our announcement',
    type: 'Repost',
    url: 'https://x.com/arcstonks',
    required: true,
    enabled: true,
    display_order: 3,
    created_at: '2026-09-06T14:48:29.000Z',
    updated_at: '2026-09-06T14:48:29.000Z',
  },
  {
    id: 'task_4',
    title: 'Comment on our announcement',
    type: 'Comment',
    url: 'https://x.com/arcstonks',
    required: true,
    enabled: true,
    display_order: 4,
    created_at: '2026-09-06T14:48:29.000Z',
    updated_at: '2026-09-06T14:48:29.000Z',
  },
];

// In-memory runtime cache for high-throughput resilience and quota preservation
let cachedTasks: WaitlistTask[] = [...DEFAULT_COMMUNITY_TASKS];
let lastTaskFetchTime = 0;
const TASK_CACHE_TTL_MS = 30 * 1000; // 30s cache

// In-memory completion store for session resilience during quota exhaustion
const inMemoryCompletions = new Map<string, { verified_at: string; proof_value?: string; task_id: string; wallet_address_lower: string }>();

// Admin stats cache
let cachedAdminStats: AdminStats | null = null;
let lastAdminStatsTime = 0;
const ADMIN_STATS_TTL_MS = 20 * 1000; // 20s cache

/**
 * Public community tasks loader.
 * CRITICAL: Highly resilient. Uses in-memory cache and canonical fallback
 * so that transient Firestore quota exhaustion or latency never breaks the public waitlist.
 */
export async function getPublicTasksFirestore(rawAddress?: string): Promise<PublicTaskItem[]> {
  const now = Date.now();
  let tasks: WaitlistTask[] = cachedTasks.length > 0 ? cachedTasks : [...DEFAULT_COMMUNITY_TASKS];

  // Refresh from Firestore if cache expired
  if (now - lastTaskFetchTime > TASK_CACHE_TTL_MS) {
    try {
      const db = getAdminDb();
      const snap = await db.collection(COLLECTIONS.TASKS).get();

      if (!snap.empty) {
        const fresh: WaitlistTask[] = [];
        snap.forEach((d: any) => {
          const data = d.data() || {};
          if (data.enabled !== false && data.enabled !== 0) {
            fresh.push({
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
        fresh.sort((a, b) => a.display_order - b.display_order);
        if (fresh.length > 0) {
          tasks = fresh;
          cachedTasks = fresh;
        }
      }
      lastTaskFetchTime = now;
    } catch (err: any) {
      console.warn('[Firestore] getPublicTasksFirestore using cache/fallback due to error:', err.message);
    }
  }

  // Enrich with user completions if a valid wallet address was provided
  const completionMap = new Map<string, { verified_at: string; proof_value?: string }>();
  if (rawAddress && isValidEvmAddress(rawAddress)) {
    const addressLower = normalizeAddress(rawAddress).toLowerCase();

    // 1. Check in-memory completions first
    inMemoryCompletions.forEach((comp) => {
      if (comp.wallet_address_lower === addressLower) {
        completionMap.set(String(comp.task_id), {
          verified_at: comp.verified_at,
          proof_value: comp.proof_value,
        });
      }
    });

    // 2. Check Firestore completions
    try {
      const db = getAdminDb();
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
    } catch (compErr: any) {
      console.warn('[Firestore] Could not load completions from Firestore:', compErr.message);
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
  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.TASKS).get();

    if (!snap.empty) {
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
      cachedTasks = tasks;
      lastTaskFetchTime = Date.now();

      // Compute completion counts safely
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
      } catch (err: any) {
        console.warn('[Firestore] Could not aggregate task completion counts:', err.message);
      }

      return tasks;
    }
  } catch (err: any) {
    console.warn('[Firestore] getAllTasksAdminFirestore error, using cache/fallback:', err.message);
  }

  return cachedTasks.length > 0 ? cachedTasks : [...DEFAULT_COMMUNITY_TASKS];
}

export async function getTaskCompletionsFirestore(
  taskId: string | number,
  limit = 50
): Promise<{ id: string | number; wallet_address: string; proof_value?: string; verified_at: string }[]> {
  const tid = String(taskId);
  const list: { id: string | number; wallet_address: string; proof_value?: string; verified_at: string }[] = [];

  // Check in-memory completions first
  inMemoryCompletions.forEach((comp, key) => {
    if (comp.task_id === tid) {
      list.push({
        id: key,
        wallet_address: comp.wallet_address_lower,
        proof_value: comp.proof_value,
        verified_at: comp.verified_at,
      });
    }
  });

  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.COMPLETIONS)
      .where('task_id', '==', tid)
      .get();
    snap.forEach((d: any) => {
      const data = d.data() || {};
      if (!list.some(item => String(item.id) === d.id)) {
        list.push({
          id: d.id,
          wallet_address: data.wallet_address || '',
          proof_value: data.proof_value || undefined,
          verified_at: data.verified_at || '',
        });
      }
    });
  } catch (err: any) {
    console.warn('[Firestore] Error getting task completions from Firestore:', err.message);
  }

  return list.slice(0, limit);
}

export async function createTaskFirestore(data: {
  title: string;
  type: string;
  url: string;
  required?: boolean;
  enabled?: boolean;
  display_order?: number;
}): Promise<WaitlistTask> {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date().toISOString();

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

  const newTask: WaitlistTask = { id: taskId, ...clean, completionCount: 0 };
  cachedTasks.push(newTask);
  cachedTasks.sort((a, b) => a.display_order - b.display_order);
  lastTaskFetchTime = Date.now();

  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTIONS.TASKS).doc(taskId);
    await docRef.set(clean);
  } catch (err: any) {
    console.warn('[Firestore] Task saved to cache, failed to persist to Firestore:', err.message);
  }

  return newTask;
}

export async function updateTaskFirestore(
  id: string | number,
  data: Partial<WaitlistTask>
): Promise<boolean> {
  const taskId = String(id);
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.type !== undefined) updates.type = data.type.trim();
  if (data.url !== undefined) updates.url = formatTaskUrl(data.url);
  if (data.required !== undefined) updates.required = Boolean(data.required);
  if (data.enabled !== undefined) updates.enabled = Boolean(data.enabled);
  if (data.display_order !== undefined) updates.display_order = Number(data.display_order);

  // Update in-memory cache immediately
  const idx = cachedTasks.findIndex(t => String(t.id) === taskId);
  if (idx !== -1) {
    cachedTasks[idx] = { ...cachedTasks[idx], ...updates };
    cachedTasks.sort((a, b) => a.display_order - b.display_order);
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTIONS.TASKS).doc(taskId);
    await docRef.set(updates, { merge: true });
  } catch (err: any) {
    console.warn('[Firestore] Task updated in cache, failed to persist to Firestore:', err.message);
  }

  return true;
}

export async function deleteTaskFirestore(id: string | number): Promise<boolean> {
  const taskId = String(id);
  cachedTasks = cachedTasks.filter(t => String(t.id) !== taskId);

  try {
    const db = getAdminDb();
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
    } catch {}
  } catch (err: any) {
    console.warn('[Firestore] Task deleted from cache, failed to delete from Firestore:', err.message);
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

  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();
  const tid = String(taskId);

  // Check if task exists in cached tasks or Firestore
  let task = cachedTasks.find(t => String(t.id) === tid);
  if (!task) {
    try {
      const db = getAdminDb();
      const taskSnap = await db.collection(COLLECTIONS.TASKS).doc(tid).get();
      if (docExists(taskSnap)) {
        const taskData = taskSnap.data() || {};
        task = {
          id: tid,
          title: taskData.title || '',
          type: taskData.type || 'Custom',
          url: formatTaskUrl(taskData.url),
          required: Boolean(taskData.required),
          enabled: Boolean(taskData.enabled),
          display_order: Number(taskData.display_order || 0),
          created_at: taskData.created_at || '',
          updated_at: taskData.updated_at || '',
        };
      }
    } catch (err: any) {
      console.warn('[Firestore] Error fetching task for verification:', err.message);
    }
  }

  if (task && task.enabled === false) {
    return { success: false, error: 'Task is disabled' };
  }

  const cleanProof = proofValue ? proofValue.trim() : null;
  const completionId = `${addressLower}_${tid}`;
  const now = new Date().toISOString();

  // Always record in in-memory completions
  inMemoryCompletions.set(completionId, {
    verified_at: now,
    proof_value: cleanProof || undefined,
    task_id: tid,
    wallet_address_lower: addressLower,
  });

  // Also persist to Firestore
  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTIONS.COMPLETIONS).doc(completionId);
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
  } catch (err: any) {
    console.warn('[Firestore] Completion saved in memory, could not persist to Firestore:', err.message);
  }

  return { success: true, verifiedAt: now, proofValue: cleanProof || undefined };
}

export async function checkRequiredTasksCompletedFirestore(
  rawAddress: string
): Promise<{ allCompleted: boolean; missingTasks: string[]; requiredTotal: number; completedRequired: number }> {
  const address = normalizeAddress(rawAddress);
  const addressLower = address.toLowerCase();

  // 1. Get all enabled & required tasks (from cache or Firestore)
  let requiredTasks: { id: string; title: string }[] = [];
  try {
    const db = getAdminDb();
    const tasksSnap = await db.collection(COLLECTIONS.TASKS).get();
    if (!tasksSnap.empty) {
      tasksSnap.forEach((d: any) => {
        const data = d.data() || {};
        if (data.enabled !== false && Boolean(data.required)) {
          requiredTasks.push({ id: d.id, title: data.title || '' });
        }
      });
    }
  } catch (err: any) {
    console.warn('[Firestore] Error reading required tasks:', err.message);
  }

  if (requiredTasks.length === 0) {
    requiredTasks = cachedTasks
      .filter(t => t.enabled !== false && t.required)
      .map(t => ({ id: String(t.id), title: t.title }));
  }

  if (requiredTasks.length === 0) {
    return { allCompleted: true, missingTasks: [], requiredTotal: 0, completedRequired: 0 };
  }

  // 2. Get completed tasks for this wallet (from memory and Firestore)
  const completedIds = new Set<string>();

  // Check in-memory completions
  inMemoryCompletions.forEach((comp) => {
    if (comp.wallet_address_lower === addressLower) {
      completedIds.add(String(comp.task_id));
    }
  });

  // Check Firestore completions
  try {
    const db = getAdminDb();
    const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
      .where('wallet_address_lower', '==', addressLower)
      .get();

    compSnap.forEach((d: any) => {
      const data = d.data() || {};
      if (data.task_id) completedIds.add(String(data.task_id));
    });
  } catch (compErr: any) {
    console.warn('[Firestore] Error reading completions from Firestore:', compErr.message);
  }

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

  const tid = String(taskId);
  const currentLower = normalizeAddress(currentAddress).toLowerCase();

  // Check in-memory completions first
  let proofConflict = false;
  inMemoryCompletions.forEach((comp) => {
    if (comp.task_id === tid && comp.wallet_address_lower !== currentLower) {
      const stored = (comp.proof_value || '').trim().toLowerCase().replace(/^@/, '');
      if (stored === clean) proofConflict = true;
    }
  });
  if (proofConflict) return true;

  try {
    const db = getAdminDb();
    const compSnap = await db.collection(COLLECTIONS.COMPLETIONS)
      .where('task_id', '==', tid)
      .get();

    for (const d of compSnap.docs) {
      const data = d.data() || {};
      const storedProof = (data.proof_value || '').trim().toLowerCase().replace(/^@/, '');
      if (storedProof === clean && data.wallet_address_lower !== currentLower) {
        return true;
      }
    }
  } catch (err: any) {
    console.warn('[Firestore] Error checking proof uniqueness:', err.message);
  }

  return false;
}

// -------------------------------------------------------------
// Admin Stats
// -------------------------------------------------------------

export async function getAdminStatsFirestore(): Promise<AdminStats> {
  const now = Date.now();
  const currentTtl = (cachedAdminStats && (cachedAdminStats.totalWaitlist > 0 || cachedAdminStats.totalEligible > 0))
    ? ADMIN_STATS_TTL_MS
    : 5000;

  if (cachedAdminStats && now - lastAdminStatsTime < currentTtl) {
    return cachedAdminStats;
  }

  const settings = await getSettingsFirestore();
  let totalWaitlist = cachedAdminStats?.totalWaitlist || 0;
  let totalEligible = cachedAdminStats?.totalEligible || 0;
  let totalAllocation = cachedAdminStats?.totalAllocation || 0;
  let totalTasks = cachedTasks.length;
  let totalCompletions = cachedAdminStats?.totalCompletions || inMemoryCompletions.size;

  try {
    const db = getAdminDb();

    // Use aggregation count() queries to minimize Firestore reads, with select() fallback
    try {
      const waitlistCountSnap = await db.collection(COLLECTIONS.WAITLIST).count().get();
      totalWaitlist = waitlistCountSnap.data().count;
    } catch (countErr: any) {
      console.warn('[Firestore] count() failed for waitlist, falling back to select query:', countErr.message);
      try {
        const snap = await db.collection(COLLECTIONS.WAITLIST).select().get();
        totalWaitlist = snap.size;
      } catch (snapErr: any) {
        console.error('[Firestore] Failed to get waitlist count:', snapErr.message);
      }
    }

    try {
      const eligibleCountSnap = await db.collection(COLLECTIONS.ELIGIBLE).count().get();
      totalEligible = eligibleCountSnap.data().count;
      totalAllocation = totalEligible;
    } catch (countErr: any) {
      console.warn('[Firestore] count() failed for eligible, falling back to select query:', countErr.message);
      try {
        const snap = await db.collection(COLLECTIONS.ELIGIBLE).select().get();
        totalEligible = snap.size;
        totalAllocation = totalEligible;
      } catch (snapErr: any) {
        console.error('[Firestore] Failed to get eligible count:', snapErr.message);
      }
    }

    try {
      const tasksCountSnap = await db.collection(COLLECTIONS.TASKS).count().get();
      totalTasks = tasksCountSnap.data().count;
    } catch {
      try {
        const snap = await db.collection(COLLECTIONS.TASKS).select().get();
        totalTasks = snap.size;
      } catch {}
    }

    try {
      const compCountSnap = await db.collection(COLLECTIONS.COMPLETIONS).count().get();
      totalCompletions = compCountSnap.data().count;
    } catch {
      try {
        const snap = await db.collection(COLLECTIONS.COMPLETIONS).select().get();
        totalCompletions = snap.size;
      } catch {}
    }
  } catch (err: any) {
    console.warn('[Firestore] Error computing admin stats (returning safe fallback):', err.message);
  }

  cachedAdminStats = {
    totalWaitlist,
    totalEligible,
    totalAllocation,
    waitlistEnabled: settings.waitlist_enabled,
    checkerEnabled: settings.checker_enabled,
    totalTasks: Math.max(totalTasks, cachedTasks.length),
    totalCompletions: Math.max(totalCompletions, inMemoryCompletions.size),
  };
  lastAdminStatsTime = now;

  return cachedAdminStats;
}
