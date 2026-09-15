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
  getAllWaitlistAddressesForExportFirestore,
  getAllWaitlistEntriesForExportFirestore,
  isWalletEligibleFirestore,
  getEligibleWalletsFirestore,
  addEligibleWalletFirestore,
  updateEligibleWalletFirestore,
  deleteEligibleWalletFirestore,
  importEligibleWalletsFirestore,
  getPublicTasksFirestore,
  getAllTasksAdminFirestore,
  getTaskCompletionsFirestore,
  createTaskFirestore,
  updateTaskFirestore,
  deleteTaskFirestore,
  verifyTaskCompletionFirestore,
  checkRequiredTasksCompletedFirestore,
  isProofUsedByAnotherWalletFirestore,
  getAdminStatsFirestore,
} from './firestore';
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
  return getAllWaitlistAddressesForExportFirestore();
}

export async function getAllWaitlistEntriesForExport(): Promise<{ wallet_address: string; x_handle?: string; created_at: string }[]> {
  return getAllWaitlistEntriesForExportFirestore();
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
  return getTaskCompletionsFirestore(taskId, limit);
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
