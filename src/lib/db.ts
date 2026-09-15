import {
  SiteSettings,
  WaitlistUser,
  EligibleWallet,
  AdminStats,
  ImportResult,
  WaitlistTask,
  PublicTaskItem
} from './types';
import {
  getSettingsFirestore,
  updateSettingsFirestore,
  getWaitlistUserByAddressFirestore,
  addWaitlistUserFirestore,
  getWaitlistUsersFirestore,
  deleteWaitlistUserFirestore,
  isWalletEligibleFirestore,
  getEligibleWalletsFirestore,
  addEligibleWalletFirestore,
  updateEligibleWalletFirestore,
  deleteEligibleWalletFirestore,
  importEligibleWalletsFirestore,
  getPublicTasksFirestore,
  getAllTasksAdminFirestore,
  createTaskFirestore,
  updateTaskFirestore,
  deleteTaskFirestore,
  verifyTaskCompletionFirestore,
  checkRequiredTasksCompletedFirestore,
  isProofUsedByAnotherWalletFirestore,
  getAdminStatsFirestore,
  COLLECTIONS,
} from './firestore';
import { getFirebaseDb } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { normalizeAddress, isValidEvmAddress } from './validation';

// -------------------------------------------------------------
// Site Settings
// -------------------------------------------------------------

export async function getSettings(): Promise<{ waitlist_enabled: boolean; checker_enabled: boolean; updated_at: string }> {
  return getSettingsFirestore();
}

export async function updateSettings(
  waitlist_enabled?: boolean,
  checker_enabled?: boolean
): Promise<{ waitlist_enabled: boolean; checker_enabled: boolean }> {
  return updateSettingsFirestore(waitlist_enabled, checker_enabled);
}

// -------------------------------------------------------------
// Waitlist Users
// -------------------------------------------------------------

export async function getWaitlistUserByAddress(rawAddress: string): Promise<WaitlistUser | null> {
  return getWaitlistUserByAddressFirestore(rawAddress);
}

export async function addWaitlistUser(
  rawAddress: string,
  ip_hash?: string,
  xHandle?: string
): Promise<{ success: boolean; alreadyExists: boolean; entry?: WaitlistUser }> {
  return addWaitlistUserFirestore(rawAddress, ip_hash, xHandle);
}

export async function getWaitlistUsers(
  search = '',
  limit = 50,
  offset = 0
): Promise<{ users: WaitlistUser[]; total: number }> {
  return getWaitlistUsersFirestore(search, limit, offset);
}

export async function getAllWaitlistAddressesForExport(): Promise<string[]> {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, COLLECTIONS.WAITLIST));
    const list: string[] = [];
    snap.forEach(d => {
      const data = d.data();
      list.push(data.wallet_address || d.id);
    });
    return list;
  } catch (err) {
    console.error('Error fetching waitlist addresses for export:', err);
    return [];
  }
}

export async function getAllWaitlistEntriesForExport(): Promise<{ wallet_address: string; x_handle?: string; created_at: string }[]> {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, COLLECTIONS.WAITLIST));
    const list: { wallet_address: string; x_handle?: string; created_at: string }[] = [];
    snap.forEach(d => {
      const data = d.data();
      list.push({
        wallet_address: data.wallet_address || d.id,
        x_handle: data.x_handle || undefined,
        created_at: data.created_at || '',
      });
    });
    return list;
  } catch (err) {
    console.error('Error fetching waitlist entries for export:', err);
    return [];
  }
}

export async function deleteWaitlistUser(id: string | number): Promise<boolean> {
  return deleteWaitlistUserFirestore(String(id));
}

// -------------------------------------------------------------
// Community Tasks System
// -------------------------------------------------------------

export async function getPublicTasks(rawAddress?: string): Promise<PublicTaskItem[]> {
  return getPublicTasksFirestore(rawAddress);
}

export async function isProofUsedByAnotherWallet(
  proofValue: string,
  taskId: string | number,
  currentAddress: string
): Promise<boolean> {
  return isProofUsedByAnotherWalletFirestore(proofValue, taskId, currentAddress);
}

export async function recordTaskCompletion(
  rawAddress: string,
  taskId: string | number,
  proofValue?: string
): Promise<{ success: boolean; error?: string; verifiedAt?: string; proofValue?: string }> {
  return verifyTaskCompletionFirestore(rawAddress, taskId, proofValue);
}

export async function checkRequiredTasksCompleted(
  rawAddress: string
): Promise<{ allCompleted: boolean; missingTasks: string[]; requiredTotal: number; completedRequired: number }> {
  return checkRequiredTasksCompletedFirestore(rawAddress);
}

// -------------------------------------------------------------
// Admin Task Management
// -------------------------------------------------------------

export async function getAllTasksAdmin(): Promise<WaitlistTask[]> {
  return getAllTasksAdminFirestore();
}

export async function getTaskCompletions(
  taskId: string | number,
  limit = 50
): Promise<{ id: string | number; wallet_address: string; proof_value?: string; verified_at: string }[]> {
  try {
    const db = getFirebaseDb();
    const compCol = collection(db, COLLECTIONS.COMPLETIONS);
    const q = query(compCol, where('task_id', '==', String(taskId)));
    const snap = await getDocs(q);
    const list: { id: string | number; wallet_address: string; proof_value?: string; verified_at: string }[] = [];
    snap.forEach(d => {
      const data = d.data();
      list.push({
        id: d.id,
        wallet_address: data.wallet_address || '',
        proof_value: data.proof_value || undefined,
        verified_at: data.verified_at || '',
      });
    });
    return list.slice(0, limit);
  } catch (err) {
    console.error('Error getting task completions:', err);
    return [];
  }
}

export function normalizeTaskUrl(rawUrl?: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return 'https://x.com/arcstonks';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  if (url.includes('123456789') || url.includes('bytewave01') || url.includes('twitter.com/ArcStonks')) {
    return 'https://x.com/arcstonks';
  }
  return url;
}

export async function createTask(data: {
  title: string;
  type: string;
  url: string;
  required?: boolean;
  enabled?: boolean;
  display_order?: number;
}): Promise<WaitlistTask> {
  return createTaskFirestore(data);
}

export async function updateTask(
  id: string | number,
  data: Partial<WaitlistTask>
): Promise<boolean> {
  return updateTaskFirestore(id, data);
}

export async function deleteTask(id: string | number): Promise<boolean> {
  return deleteTaskFirestore(id);
}

// -------------------------------------------------------------
// Eligible / Whitelist Wallets
// -------------------------------------------------------------

export async function checkWalletEligibility(
  rawAddress: string
): Promise<{ eligible: boolean; allocation?: number; status?: string }> {
  const result = await isWalletEligibleFirestore(rawAddress);
  return {
    eligible: result.eligible,
    allocation: result.allocation,
    status: result.status,
  };
}

export async function getEligibleWallets(
  search = '',
  limit = 50,
  offset = 0
): Promise<{ wallets: EligibleWallet[]; total: number }> {
  return getEligibleWalletsFirestore(search, limit, offset);
}

export async function addEligibleWallet(
  rawAddress: string,
  allocation = 1
): Promise<{ success: boolean; error?: string; wallet?: EligibleWallet }> {
  try {
    const wallet = await addEligibleWalletFirestore(rawAddress, allocation);
    return { success: true, wallet };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateEligibleWallet(
  id: string | number,
  allocation: number,
  status = 'active'
): Promise<boolean> {
  return updateEligibleWalletFirestore(String(id), allocation, status);
}

export async function deleteEligibleWallet(id: string | number): Promise<boolean> {
  return deleteEligibleWalletFirestore(String(id));
}

export async function batchImportEligibleWallets(
  records: { rawAddress: string; allocation?: number }[]
): Promise<ImportResult> {
  const formatted = records.map(r => ({ address: r.rawAddress, allocation: r.allocation }));
  return importEligibleWalletsFirestore(formatted);
}

// -------------------------------------------------------------
// Admin Stats
// -------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  return getAdminStatsFirestore();
}
