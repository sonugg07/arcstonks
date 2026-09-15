export interface SiteSettings {
  id: string | number;
  waitlist_enabled: boolean | number;
  checker_enabled: boolean | number;
  updated_at: string;
}

export interface WaitlistUser {
  id: string | number;
  wallet_address: string;
  created_at: string;
  ip_hash?: string;
  x_handle?: string;
}

export interface EligibleWallet {
  id: string | number;
  wallet_address: string;
  allocation: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  totalWaitlist: number;
  totalEligible: number;
  totalAllocation: number;
  waitlistEnabled: boolean;
  checkerEnabled: boolean;
  totalTasks?: number;
  totalCompletions?: number;
}

export interface WalletCheckResponse {
  address: string;
  eligible: boolean;
  allocation?: number;
  status?: string;
  message?: string;
}

export interface ImportResult {
  totalProcessed: number;
  successfulCount: number;
  invalidCount: number;
  duplicateCount: number;
  successful: { address: string; allocation: number }[];
  invalid: { address: string; reason: string }[];
  duplicates: string[];
}

export interface WaitlistTask {
  id: string | number;
  title: string;
  type: string; // 'Follow' | 'Like' | 'Repost' | 'Comment' | 'Join' | 'Visit' | string
  url: string;
  required: boolean | number;
  enabled: boolean | number;
  display_order: number;
  created_at: string;
  updated_at: string;
  completionCount?: number;
}

export interface WaitlistTaskCompletion {
  id: string | number;
  wallet_address: string;
  task_id: string | number;
  status: string;
  proof_value?: string;
  verified_at: string;
  created_at: string;
}

export interface PublicTaskItem {
  id: string | number;
  title: string;
  type: string;
  url: string;
  required: boolean;
  enabled: boolean;
  display_order: number;
  completed: boolean;
  proof_value?: string;
  verified_at?: string;
}
