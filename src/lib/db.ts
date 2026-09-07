import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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

const DB_PATH = path.join(process.cwd(), 'arcstonks.db');

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Global database instance with WAL mode for high concurrency
let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      waitlist_enabled INTEGER NOT NULL DEFAULT 1,
      checker_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS waitlist_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL COLLATE NOCASE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_waitlist_address ON waitlist_users(wallet_address);

    CREATE TABLE IF NOT EXISTS eligible_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL COLLATE NOCASE,
      allocation INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_eligible_address ON eligible_wallets(wallet_address);

    -- Community Social Tasks
    CREATE TABLE IF NOT EXISTS waitlist_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Task Completions per Wallet Address
    CREATE TABLE IF NOT EXISTS waitlist_task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL COLLATE NOCASE,
      task_id INTEGER NOT NULL REFERENCES waitlist_tasks(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'completed',
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(wallet_address, task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_comp_wallet ON waitlist_task_completions(wallet_address);
  `);

  // Schema migrations for proof_value and x_handle
  try {
    database.exec('ALTER TABLE waitlist_users ADD COLUMN x_handle TEXT;');
  } catch {}

  try {
    database.exec('ALTER TABLE waitlist_task_completions ADD COLUMN proof_value TEXT;');
  } catch {}

  try {
    database.exec('CREATE INDEX IF NOT EXISTS idx_task_comp_proof ON waitlist_task_completions(proof_value, task_id);');
  } catch {}

  // Ensure default site_settings exists
  const existing = database.prepare('SELECT id FROM site_settings WHERE id = 1').get();
  if (!existing) {
    database.prepare(`
      INSERT INTO site_settings (id, waitlist_enabled, checker_enabled, updated_at)
      VALUES (1, 1, 1, CURRENT_TIMESTAMP)
    `).run();
  }

  // Seed default social tasks if table is empty
  const taskCount = database.prepare('SELECT COUNT(*) as count FROM waitlist_tasks').get() as { count: number };
  if (taskCount.count === 0) {
    const defaultTasks = [
      {
        title: 'Follow ArcStonks on X',
        type: 'Follow',
        url: 'https://twitter.com/ArcStonks',
        required: 1,
        enabled: 1,
        display_order: 1,
      },
      {
        title: 'Like our announcement',
        type: 'Like',
        url: 'https://twitter.com/ArcStonks/status/123456789',
        required: 1,
        enabled: 1,
        display_order: 2,
      },
      {
        title: 'Repost our announcement',
        type: 'Repost',
        url: 'https://twitter.com/ArcStonks/status/123456789',
        required: 1,
        enabled: 1,
        display_order: 3,
      },
      {
        title: 'Comment on our announcement',
        type: 'Comment',
        url: 'https://twitter.com/ArcStonks/status/123456789',
        required: 1,
        enabled: 1,
        display_order: 4,
      },
    ];

    const insertTask = database.prepare(`
      INSERT INTO waitlist_tasks (title, type, url, required, enabled, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    database.transaction(() => {
      for (const t of defaultTasks) {
        insertTask.run(t.title, t.type, t.url, t.required, t.enabled, t.display_order);
      }
    })();
  }
}

// -------------------------------------------------------------
// Site Settings
// -------------------------------------------------------------

export function getSettings(): { waitlist_enabled: boolean; checker_enabled: boolean; updated_at: string } {
  const d = getDb();
  const row = d.prepare('SELECT waitlist_enabled, checker_enabled, updated_at FROM site_settings WHERE id = 1').get() as any;
  if (!row) {
    return { waitlist_enabled: true, checker_enabled: true, updated_at: new Date().toISOString() };
  }
  return {
    waitlist_enabled: Boolean(row.waitlist_enabled),
    checker_enabled: Boolean(row.checker_enabled),
    updated_at: row.updated_at,
  };
}

export function updateSettings(waitlist_enabled?: boolean, checker_enabled?: boolean): { waitlist_enabled: boolean; checker_enabled: boolean } {
  const d = getDb();
  const current = getSettings();
  const newWaitlist = waitlist_enabled !== undefined ? (waitlist_enabled ? 1 : 0) : (current.waitlist_enabled ? 1 : 0);
  const newChecker = checker_enabled !== undefined ? (checker_enabled ? 1 : 0) : (current.checker_enabled ? 1 : 0);

  d.prepare(`
    UPDATE site_settings
    SET waitlist_enabled = ?, checker_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(newWaitlist, newChecker);

  return {
    waitlist_enabled: Boolean(newWaitlist),
    checker_enabled: Boolean(newChecker),
  };
}

// -------------------------------------------------------------
// Waitlist Users
// -------------------------------------------------------------

export function addWaitlistUser(rawAddress: string, ip_hash?: string, xHandle?: string): { success: boolean; alreadyExists: boolean; entry?: WaitlistUser } {
  const d = getDb();
  const address = normalizeAddress(rawAddress);

  const existing = d.prepare('SELECT * FROM waitlist_users WHERE wallet_address = ?').get(address) as WaitlistUser | undefined;
  if (existing) {
    if (xHandle && !existing.x_handle) {
      d.prepare('UPDATE waitlist_users SET x_handle = ? WHERE id = ?').run(xHandle.trim(), existing.id);
      existing.x_handle = xHandle.trim();
    }
    return { success: true, alreadyExists: true, entry: existing };
  }

  const cleanHandle = xHandle ? xHandle.trim() : null;
  const result = d.prepare(`
    INSERT INTO waitlist_users (wallet_address, ip_hash, x_handle, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(address, ip_hash || null, cleanHandle);

  const entry = d.prepare('SELECT * FROM waitlist_users WHERE id = ?').get(result.lastInsertRowid) as WaitlistUser;
  return { success: true, alreadyExists: false, entry };
}

export function getWaitlistUsers(search = '', limit = 50, offset = 0): { users: WaitlistUser[]; total: number } {
  const d = getDb();
  const searchTerm = `%${search.trim().toLowerCase()}%`;

  if (search.trim()) {
    const totalRow = d.prepare('SELECT COUNT(*) as count FROM waitlist_users WHERE wallet_address LIKE ? OR x_handle LIKE ?').get(searchTerm, searchTerm) as { count: number };
    const users = d.prepare(`
      SELECT * FROM waitlist_users
      WHERE wallet_address LIKE ? OR x_handle LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(searchTerm, searchTerm, limit, offset) as WaitlistUser[];
    return { users, total: totalRow.count };
  } else {
    const totalRow = d.prepare('SELECT COUNT(*) as count FROM waitlist_users').get() as { count: number };
    const users = d.prepare(`
      SELECT * FROM waitlist_users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as WaitlistUser[];
    return { users, total: totalRow.count };
  }
}

export function getAllWaitlistAddressesForExport(): string[] {
  const d = getDb();
  const rows = d.prepare('SELECT wallet_address FROM waitlist_users ORDER BY created_at ASC').all() as { wallet_address: string }[];
  return rows.map(r => r.wallet_address);
}

export function getAllWaitlistEntriesForExport(): { wallet_address: string; x_handle?: string; created_at: string }[] {
  const d = getDb();
  return d.prepare(`
    SELECT wallet_address, x_handle, created_at
    FROM waitlist_users
    ORDER BY created_at ASC
  `).all() as { wallet_address: string; x_handle?: string; created_at: string }[];
}

export function deleteWaitlistUser(id: number): boolean {
  const d = getDb();
  const result = d.prepare('DELETE FROM waitlist_users WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------------------------------------------
// Community Tasks System
// -------------------------------------------------------------

/**
 * Returns public tasks that are enabled, optionally enriched with completion status for a given wallet
 */
export function getPublicTasks(rawAddress?: string): PublicTaskItem[] {
  const d = getDb();
  const tasks = d.prepare(`
    SELECT id, title, type, url, required, enabled, display_order
    FROM waitlist_tasks
    WHERE enabled = 1
    ORDER BY display_order ASC, id ASC
  `).all() as WaitlistTask[];

  let completedIds = new Set<number>();
  let completionMap = new Map<number, string>();
  let proofMap = new Map<number, string>();

  if (rawAddress && isValidEvmAddress(rawAddress)) {
    const address = normalizeAddress(rawAddress);
    const rows = d.prepare(`
      SELECT task_id, verified_at, proof_value
      FROM waitlist_task_completions
      WHERE wallet_address = ? AND status = 'completed'
    `).all(address) as { task_id: number; verified_at: string; proof_value?: string }[];

    for (const r of rows) {
      completedIds.add(r.task_id);
      completionMap.set(r.task_id, r.verified_at);
      if (r.proof_value) {
        proofMap.set(r.task_id, r.proof_value);
      }
    }
  }

  return tasks.map(t => ({
    id: t.id,
    title: t.title,
    type: t.type,
    url: t.url,
    required: Boolean(t.required),
    enabled: Boolean(t.enabled),
    display_order: t.display_order,
    completed: completedIds.has(t.id),
    verified_at: completionMap.get(t.id),
    proof_value: proofMap.get(t.id),
  }));
}

/**
 * Checks if a social handle/proof is already used by another wallet for the same task
 */
export function isProofUsedByAnotherWallet(proofValue: string, taskId: number, currentAddress: string): boolean {
  const d = getDb();
  const clean = proofValue.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return false;

  const currentNormalized = normalizeAddress(currentAddress);

  const row = d.prepare(`
    SELECT wallet_address FROM waitlist_task_completions
    WHERE task_id = ? 
      AND LOWER(REPLACE(proof_value, '@', '')) = ?
      AND wallet_address != ?
      AND status = 'completed'
    LIMIT 1
  `).get(taskId, clean, currentNormalized) as { wallet_address: string } | undefined;

  return !!row;
}

/**
 * Record a user task completion with proof (X handle / comment url)
 */
export function recordTaskCompletion(
  rawAddress: string, 
  taskId: number, 
  proofValue?: string
): { success: boolean; error?: string; verifiedAt?: string; proofValue?: string } {
  const d = getDb();
  const address = normalizeAddress(rawAddress);

  if (!isValidEvmAddress(address)) {
    return { success: false, error: 'Invalid EVM address format' };
  }

  const task = d.prepare('SELECT id, enabled FROM waitlist_tasks WHERE id = ?').get(taskId) as WaitlistTask | undefined;
  if (!task || !task.enabled) {
    return { success: false, error: 'Task not found or disabled' };
  }

  const cleanProof = proofValue ? proofValue.trim() : null;

  d.prepare(`
    INSERT INTO waitlist_task_completions (wallet_address, task_id, status, proof_value, verified_at, created_at)
    VALUES (?, ?, 'completed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(wallet_address, task_id) DO UPDATE SET
      status = 'completed',
      proof_value = coalesce(excluded.proof_value, waitlist_task_completions.proof_value),
      verified_at = CURRENT_TIMESTAMP
  `).run(address, taskId, cleanProof);

  const completion = d.prepare(`
    SELECT verified_at, proof_value FROM waitlist_task_completions
    WHERE wallet_address = ? AND task_id = ?
  `).get(address, taskId) as { verified_at: string; proof_value?: string };

  return { 
    success: true, 
    verifiedAt: completion.verified_at, 
    proofValue: completion.proof_value || cleanProof || undefined 
  };
}

/**
 * Validates that all currently enabled & required tasks have been completed by the wallet
 */
export function checkRequiredTasksCompleted(rawAddress: string): { allCompleted: boolean; missingTasks: string[]; requiredTotal: number; completedRequired: number } {
  const d = getDb();
  const address = normalizeAddress(rawAddress);

  const requiredTasks = d.prepare(`
    SELECT id, title
    FROM waitlist_tasks
    WHERE enabled = 1 AND required = 1
    ORDER BY display_order ASC
  `).all() as { id: number; title: string }[];

  if (requiredTasks.length === 0) {
    return { allCompleted: true, missingTasks: [], requiredTotal: 0, completedRequired: 0 };
  }

  const completed = d.prepare(`
    SELECT task_id
    FROM waitlist_task_completions
    WHERE wallet_address = ? AND status = 'completed'
  `).all(address) as { task_id: number }[];

  const completedSet = new Set(completed.map(c => c.task_id));
  const missingTasks: string[] = [];
  let completedRequired = 0;

  for (const t of requiredTasks) {
    if (completedSet.has(t.id)) {
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

// -------------------------------------------------------------
// Admin Task Management
// -------------------------------------------------------------

export function getAllTasksAdmin(): WaitlistTask[] {
  const d = getDb();
  const rows = d.prepare(`
    SELECT 
      t.*,
      COUNT(c.id) as completionCount
    FROM waitlist_tasks t
    LEFT JOIN waitlist_task_completions c ON t.id = c.task_id AND c.status = 'completed'
    GROUP BY t.id
    ORDER BY t.display_order ASC, t.id ASC
  `).all() as any[];

  return rows.map(r => ({
    ...r,
    completionCount: r.completionCount || 0,
  }));
}

export function getTaskCompletions(taskId: number, limit = 50): { id: number; wallet_address: string; proof_value?: string; verified_at: string }[] {
  const d = getDb();
  return d.prepare(`
    SELECT id, wallet_address, proof_value, verified_at
    FROM waitlist_task_completions
    WHERE task_id = ? AND status = 'completed'
    ORDER BY verified_at DESC
    LIMIT ?
  `).all(taskId, limit) as { id: number; wallet_address: string; proof_value?: string; verified_at: string }[];
}

export function createTask(data: {
  title: string;
  type: string;
  url: string;
  required?: boolean;
  enabled?: boolean;
  display_order?: number;
}): WaitlistTask {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO waitlist_tasks (title, type, url, required, enabled, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    data.title.trim(),
    data.type.trim(),
    data.url.trim(),
    data.required ? 1 : 0,
    data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
    data.display_order !== undefined ? data.display_order : 0
  );

  return d.prepare('SELECT * FROM waitlist_tasks WHERE id = ?').get(result.lastInsertRowid) as WaitlistTask;
}

export function updateTask(id: number, data: Partial<{
  title: string;
  type: string;
  url: string;
  required: boolean;
  enabled: boolean;
  display_order: number;
}>): boolean {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM waitlist_tasks WHERE id = ?').get(id) as WaitlistTask | undefined;
  if (!existing) return false;

  const newTitle = data.title !== undefined ? data.title.trim() : existing.title;
  const newType = data.type !== undefined ? data.type.trim() : existing.type;
  const newUrl = data.url !== undefined ? data.url.trim() : existing.url;
  const newRequired = data.required !== undefined ? (data.required ? 1 : 0) : existing.required;
  const newEnabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled;
  const newOrder = data.display_order !== undefined ? data.display_order : existing.display_order;

  const result = d.prepare(`
    UPDATE waitlist_tasks
    SET title = ?, type = ?, url = ?, required = ?, enabled = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newTitle, newType, newUrl, newRequired, newEnabled, newOrder, id);

  return result.changes > 0;
}

export function deleteTask(id: number): boolean {
  const d = getDb();
  d.prepare('DELETE FROM waitlist_task_completions WHERE task_id = ?').run(id);
  const result = d.prepare('DELETE FROM waitlist_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

// -------------------------------------------------------------
// Eligible / Whitelist Wallets
// -------------------------------------------------------------

export function checkWalletEligibility(rawAddress: string): { eligible: boolean; allocation?: number; status?: string } {
  const d = getDb();
  const address = normalizeAddress(rawAddress);

  const row = d.prepare(`
    SELECT allocation, status
    FROM eligible_wallets
    WHERE wallet_address = ? AND status = 'active'
  `).get(address) as { allocation: number; status: string } | undefined;

  if (row) {
    return { eligible: true, allocation: row.allocation, status: row.status };
  }
  return { eligible: false };
}

export function getEligibleWallets(search = '', limit = 50, offset = 0): { wallets: EligibleWallet[]; total: number } {
  const d = getDb();
  const searchTerm = `%${search.trim().toLowerCase()}%`;

  if (search.trim()) {
    const totalRow = d.prepare('SELECT COUNT(*) as count FROM eligible_wallets WHERE wallet_address LIKE ?').get(searchTerm) as { count: number };
    const wallets = d.prepare(`
      SELECT * FROM eligible_wallets
      WHERE wallet_address LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(searchTerm, limit, offset) as EligibleWallet[];
    return { wallets, total: totalRow.count };
  } else {
    const totalRow = d.prepare('SELECT COUNT(*) as count FROM eligible_wallets').get() as { count: number };
    const wallets = d.prepare(`
      SELECT * FROM eligible_wallets
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as EligibleWallet[];
    return { wallets, total: totalRow.count };
  }
}

export function addEligibleWallet(rawAddress: string, allocation = 1): { success: boolean; error?: string; wallet?: EligibleWallet } {
  const d = getDb();
  const address = normalizeAddress(rawAddress);

  if (!isValidEvmAddress(address)) {
    return { success: false, error: 'Invalid EVM wallet address format' };
  }

  const existing = d.prepare('SELECT id FROM eligible_wallets WHERE wallet_address = ?').get(address);
  if (existing) {
    return { success: false, error: 'Wallet is already in eligible list' };
  }

  const result = d.prepare(`
    INSERT INTO eligible_wallets (wallet_address, allocation, status, created_at, updated_at)
    VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(address, Math.max(1, allocation));

  const wallet = d.prepare('SELECT * FROM eligible_wallets WHERE id = ?').get(result.lastInsertRowid) as EligibleWallet;
  return { success: true, wallet };
}

export function updateEligibleWallet(id: number, allocation: number, status = 'active'): boolean {
  const d = getDb();
  const result = d.prepare(`
    UPDATE eligible_wallets
    SET allocation = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Math.max(1, allocation), status, id);
  return result.changes > 0;
}

export function deleteEligibleWallet(id: number): boolean {
  const d = getDb();
  const result = d.prepare('DELETE FROM eligible_wallets WHERE id = ?').run(id);
  return result.changes > 0;
}

export function batchImportEligibleWallets(records: { rawAddress: string; allocation?: number }[]): ImportResult {
  const d = getDb();
  const result: ImportResult = {
    totalProcessed: records.length,
    successfulCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    successful: [],
    invalid: [],
    duplicates: [],
  };

  const checkStmt = d.prepare('SELECT id FROM eligible_wallets WHERE wallet_address = ?');
  const insertStmt = d.prepare(`
    INSERT INTO eligible_wallets (wallet_address, allocation, status, created_at, updated_at)
    VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const seenInBatch = new Set<string>();

  const transaction = d.transaction(() => {
    for (const item of records) {
      const address = normalizeAddress(item.rawAddress);

      if (!isValidEvmAddress(address)) {
        result.invalidCount++;
        result.invalid.push({ address: item.rawAddress, reason: 'Invalid 0x EVM format' });
        continue;
      }

      if (seenInBatch.has(address)) {
        result.duplicateCount++;
        result.duplicates.push(address);
        continue;
      }
      seenInBatch.add(address);

      const existing = checkStmt.get(address);
      if (existing) {
        result.duplicateCount++;
        result.duplicates.push(address);
        continue;
      }

      const alloc = Math.max(1, item.allocation || 1);
      insertStmt.run(address, alloc);
      result.successfulCount++;
      result.successful.push({ address, allocation: alloc });
    }
  });

  transaction();
  return result;
}

// -------------------------------------------------------------
// Admin Stats
// -------------------------------------------------------------

export function getAdminStats(): AdminStats {
  const d = getDb();
  const waitlistCount = (d.prepare('SELECT COUNT(*) as count FROM waitlist_users').get() as any).count || 0;
  const eligibleRow = d.prepare('SELECT COUNT(*) as count, COALESCE(SUM(allocation), 0) as totalAlloc FROM eligible_wallets').get() as any;
  const taskCount = (d.prepare('SELECT COUNT(*) as count FROM waitlist_tasks').get() as any).count || 0;
  const completionCount = (d.prepare("SELECT COUNT(*) as count FROM waitlist_task_completions WHERE status = 'completed'").get() as any).count || 0;
  const settings = getSettings();

  return {
    totalWaitlist: waitlistCount,
    totalEligible: eligibleRow.count || 0,
    totalAllocation: eligibleRow.totalAlloc || 0,
    waitlistEnabled: settings.waitlist_enabled,
    checkerEnabled: settings.checker_enabled,
    totalTasks: taskCount,
    totalCompletions: completionCount,
  };
}
