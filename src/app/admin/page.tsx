'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  KeyRound,
  Lock,
  Unlock,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  Users,
  Layers,
  ArrowRight,
  Database,
  FileText,
  ListTodo,
} from 'lucide-react';
import { WaitlistUser, EligibleWallet, AdminStats, ImportResult, WaitlistTask } from '@/lib/types';
import { shortenAddress, isValidEvmAddress } from '@/lib/validation';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs: 'waitlist' | 'eligible' | 'tasks' | 'settings'
  const [activeTab, setActiveTab] = useState<'waitlist' | 'eligible' | 'tasks' | 'settings'>('waitlist');

  // Stats & Toggles
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Tasks data
  const [tasks, setTasks] = useState<WaitlistTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<WaitlistTask | null>(null);

  // Add Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState('Follow');
  const [taskUrl, setTaskUrl] = useState('');
  const [taskRequired, setTaskRequired] = useState(true);
  const [taskEnabled, setTaskEnabled] = useState(true);
  const [taskOrder, setTaskOrder] = useState('0');
  const [taskError, setTaskError] = useState<string | null>(null);

  // Waitlist data
  const [waitlistUsers, setWaitlistUsers] = useState<WaitlistUser[]>([]);
  const [waitlistTotal, setWaitlistTotal] = useState(0);
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistPage, setWaitlistPage] = useState(0);

  // Eligible Wallets data
  const [eligibleWallets, setEligibleWallets] = useState<EligibleWallet[]>([]);
  const [eligibleTotal, setEligibleTotal] = useState(0);
  const [eligibleSearch, setEligibleSearch] = useState('');
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligiblePage, setEligiblePage] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<EligibleWallet | null>(null);

  // Add Wallet Form
  const [newAddress, setNewAddress] = useState('');
  const [newAllocation, setNewAllocation] = useState('1');
  const [addError, setAddError] = useState<string | null>(null);

  // CSV Upload Form
  const [csvContent, setCsvContent] = useState('');
  const [csvDefaultAlloc, setCsvDefaultAlloc] = useState('1');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [importReport, setImportReport] = useState<ImportResult | null>(null);

  // Copied toast helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Check auth
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/me', { cache: 'no-store' });
      const data = await res.json();
      setAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchStats();
      }
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  // Fetch Waitlist
  const fetchWaitlist = useCallback(async () => {
    setWaitlistLoading(true);
    try {
      const limit = 25;
      const offset = waitlistPage * limit;
      const res = await fetch(
        `/api/admin/waitlist?search=${encodeURIComponent(waitlistSearch)}&limit=${limit}&offset=${offset}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setWaitlistUsers(data.users);
        setWaitlistTotal(data.total);
      }
    } finally {
      setWaitlistLoading(false);
    }
  }, [waitlistSearch, waitlistPage]);

  // Fetch Eligible
  const fetchEligible = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const limit = 25;
      const offset = eligiblePage * limit;
      const res = await fetch(
        `/api/admin/eligible?search=${encodeURIComponent(eligibleSearch)}&limit=${limit}&offset=${offset}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setEligibleWallets(data.wallets);
        setEligibleTotal(data.total);
      }
    } finally {
      setEligibleLoading(false);
    }
  }, [eligibleSearch, eligiblePage]);

  // Fetch Tasks
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch('/api/admin/tasks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      if (activeTab === 'waitlist') {
        fetchWaitlist();
      } else if (activeTab === 'eligible') {
        fetchEligible();
      } else if (activeTab === 'tasks') {
        fetchTasks();
      }
    }
  }, [authenticated, activeTab, fetchWaitlist, fetchEligible, fetchTasks]);

  // Create Task Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);

    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          type: taskType,
          url: taskUrl,
          required: taskRequired,
          enabled: taskEnabled,
          display_order: parseInt(taskOrder, 10) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create task');
      }

      setShowAddTaskModal(false);
      setTaskTitle('');
      setTaskUrl('');
      setTaskType('Follow');
      setTaskRequired(true);
      setTaskEnabled(true);
      setTaskOrder('0');
      fetchTasks();
    } catch (err: any) {
      setTaskError(err.message);
    }
  };

  // Update Task Handler
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const res = await fetch(`/api/admin/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTask.title,
          type: editingTask.type,
          url: editingTask.url,
          required: Boolean(editingTask.required),
          enabled: Boolean(editingTask.enabled),
          display_order: editingTask.display_order,
        }),
      });

      if (res.ok) {
        setShowEditTaskModal(false);
        setEditingTask(null);
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to update task', err);
    }
  };

  // Toggle Task Required
  const handleToggleTaskRequired = async (task: WaitlistTask) => {
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required: !task.required }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to toggle task required', err);
    }
  };

  // Toggle Task Enabled
  const handleToggleTaskEnabled = async (task: WaitlistTask) => {
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to toggle task enabled', err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: number) => {
    if (!confirm('Are you sure you want to delete this community task?')) return;

    try {
      const res = await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setAuthenticated(true);
      fetchStats();
      fetchWaitlist();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid admin credentials');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setPassword('');
  };

  // Toggle Settings Handler (Persistent)
  const handleToggle = async (key: 'waitlist_enabled' | 'checker_enabled') => {
    if (!stats) return;
    setUpdatingSettings(true);

    const updatedValue = key === 'waitlist_enabled' ? !stats.waitlistEnabled : !stats.checkerEnabled;

    try {
      const payload = key === 'waitlist_enabled'
        ? { waitlist_enabled: updatedValue }
        : { checker_enabled: updatedValue };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Update local state immediately
        setStats({
          ...stats,
          waitlistEnabled: key === 'waitlist_enabled' ? updatedValue : stats.waitlistEnabled,
          checkerEnabled: key === 'checker_enabled' ? updatedValue : stats.checkerEnabled,
        });
      }
    } catch (err) {
      console.error('Failed to update toggle', err);
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Delete waitlist user
  const handleDeleteWaitlist = async (id: number) => {
    if (!confirm('Are you sure you want to delete this waitlist submission?')) return;

    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchWaitlist();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete waitlist user', err);
    }
  };

  // Add eligible wallet
  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const trimmed = newAddress.trim();
    if (!isValidEvmAddress(trimmed)) {
      setAddError('Invalid EVM address format (must be 0x followed by 40 hex chars).');
      return;
    }

    try {
      const res = await fetch('/api/admin/eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: trimmed,
          allocation: parseInt(newAllocation, 10) || 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add wallet');
      }

      setShowAddModal(false);
      setNewAddress('');
      setNewAllocation('1');
      fetchEligible();
      fetchStats();
    } catch (err: any) {
      setAddError(err.message);
    }
  };

  // Update eligible wallet
  const handleUpdateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;

    try {
      const res = await fetch(`/api/admin/eligible/${editingWallet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocation: editingWallet.allocation,
          status: editingWallet.status,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setEditingWallet(null);
        fetchEligible();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to update wallet', err);
    }
  };

  // Delete eligible wallet
  const handleDeleteEligible = async (id: number) => {
    if (!confirm('Are you sure you want to delete this eligible wallet?')) return;

    try {
      const res = await fetch(`/api/admin/eligible/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEligible();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete eligible wallet', err);
    }
  };

  // CSV Import handler
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;

    setUploadLoading(true);
    setImportReport(null);

    try {
      const res = await fetch('/api/admin/eligible/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvContent,
          defaultAllocation: parseInt(csvDefaultAlloc, 10) || 1,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportReport(data.result);
        fetchEligible();
        fetchStats();
      } else {
        alert(data.error || 'CSV import failed');
      }
    } catch (err) {
      alert('Error communicating with server during import');
    } finally {
      setUploadLoading(false);
    }
  };

  // Promote Waitlist to Eligible in 1-Click
  const handlePromoteWaitlist = async () => {
    if (!confirm('Promote all current waitlist submissions to the eligible whitelist? (Duplicates will be skipped automatically)')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/eligible/batch-from-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocation: 1 }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Promoted ${data.result.successfulCount} wallets! (Duplicates: ${data.result.duplicateCount})`);
        fetchEligible();
        fetchStats();
      } else {
        alert(data.error || 'Promotion failed');
      }
    } catch {
      alert('Error promoting waitlist');
    }
  };

  // Handle CSV file drop / selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvContent(evt.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  // Loading state
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06090e] text-cyan-400 font-mono">
        <RefreshCw className="w-6 h-6 animate-spin mr-3" />
        <span>Authenticating Admin Gateway...</span>
      </div>
    );
  }

  // Login Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#06090e] relative">
        <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />

        <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-cyan-500/30 shadow-cyan-glow relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-400 mb-3 shadow-lg">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold font-mono text-white tracking-wider uppercase">
              ArcStonks Security Gateway
            </h1>
            <p className="text-xs text-slate-400">
              Restricted management console for collection administrators.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold uppercase text-cyan-300">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrative password"
                  required
                  className="w-full bg-[#070e17] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-mono font-bold text-xs uppercase tracking-wider hover:shadow-cyan-glow transition-all flex items-center justify-center space-x-2"
            >
              {loginLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Access Terminal</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-cyan-500/10 flex justify-between items-center text-[11px] font-mono text-slate-400">
            <span>Admin Password: <code className="text-cyan-400">arcstonks@9888</code></span>
            <Link href="/" className="text-slate-400 hover:text-cyan-300 flex items-center space-x-1">
              <span>Back to Site</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-[#06090e] text-slate-200 pb-20 relative">
      {/* Top Navigation Bar */}
      <header className="border-b border-cyan-500/20 bg-[#070d17]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <KeyRound className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="pixel-text text-sm font-bold text-white tracking-wider glow-cyan">
                  ARC<span className="text-cyan-400">STONKS</span>
                </div>
                <div className="text-[10px] font-mono text-cyan-400/80 tracking-wider uppercase">
                  Admin Command Console
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/"
              target="_blank"
              className="px-3.5 py-1.5 rounded-lg border border-cyan-500/20 text-xs font-mono text-slate-300 hover:text-cyan-300 hover:bg-cyan-950/30 flex items-center space-x-1.5"
            >
              <span>View Public Site</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-xs font-mono flex items-center space-x-1.5"
            >
              <LogOut className="w-3 h-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Top Operational Controls & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Waitlist Count Card */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="uppercase">Total Waitlist Users</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-white glow-cyan">
              {stats?.totalWaitlist.toLocaleString() || 0}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Public submissions in <code className="text-cyan-400">waitlist_users</code>
            </div>
          </div>

          {/* Eligible Count Card */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="uppercase">Eligible Whitelist</span>
              <Layers className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-white glow-teal">
              {stats?.totalEligible.toLocaleString() || 0}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Approved wallets in <code className="text-teal-400">eligible_wallets</code>
            </div>
          </div>

          {/* Waitlist Control Card */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="uppercase">Waitlist Switch</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.waitlistEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-white">
                WAITLIST: {stats?.waitlistEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                onClick={() => handleToggle('waitlist_enabled')}
                disabled={updatingSettings}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  stats?.waitlistEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    stats?.waitlistEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {stats?.waitlistEnabled ? 'Public submissions active' : 'Submissions locked'}
            </div>
          </div>

          {/* Wallet Checker Control Card */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="uppercase">Checker Switch</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.checkerEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-white">
                CHECKER: {stats?.checkerEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                onClick={() => handleToggle('checker_enabled')}
                disabled={updatingSettings}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  stats?.checkerEnabled ? 'bg-teal-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    stats?.checkerEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {stats?.checkerEnabled ? 'Public checker operational' : 'Checker unavailable'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('waitlist')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                activeTab === 'waitlist'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Waitlist Users ({stats?.totalWaitlist || 0})
            </button>
            <button
              onClick={() => setActiveTab('eligible')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                activeTab === 'eligible'
                  ? 'bg-teal-500/20 border border-teal-400 text-teal-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Eligible Wallets ({stats?.totalEligible || 0})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                activeTab === 'tasks'
                  ? 'bg-sky-500/20 border border-sky-400 text-sky-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Waitlist Tasks ({tasks.length})
            </button>
          </div>

          <div className="text-xs font-mono text-slate-500 hidden sm:block">
            Storage: Persistent SQLite (<code className="text-slate-400">arcstonks.db</code>)
          </div>
        </div>

        {/* TAB 1: WAITLIST USERS */}
        {activeTab === 'waitlist' && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={waitlistSearch}
                  onChange={(e) => {
                    setWaitlistSearch(e.target.value);
                    setWaitlistPage(0);
                  }}
                  placeholder="Search waitlist wallet address (0x...)"
                  className="w-full bg-[#080e18] border border-cyan-500/20 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handlePromoteWaitlist}
                  className="px-3.5 py-2 rounded-xl border border-teal-500/40 bg-teal-950/30 text-teal-300 hover:bg-teal-900/40 text-xs font-mono flex items-center space-x-1.5 font-semibold"
                  title="Promote all waitlist wallets to eligible whitelist"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Promote to Whitelist</span>
                </button>

                {/* CSV Export Button */}
                <a
                  href="/api/admin/waitlist/export"
                  download="wallet_address.csv"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 hover:shadow-cyan-glow transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </a>
              </div>
            </div>

            {/* Waitlist Table */}
            <div className="glass-panel rounded-2xl border border-cyan-500/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#080d16] border-b border-cyan-500/20 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4"># ID</th>
                      <th className="py-3.5 px-4">Wallet Address</th>
                      <th className="py-3.5 px-4">X (Twitter) Handle</th>
                      <th className="py-3.5 px-4">Submission Date</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10">
                    {waitlistLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                          <span>Loading Waitlist Submissions...</span>
                        </td>
                      </tr>
                    ) : waitlistUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          {waitlistSearch ? 'No matching wallet addresses found.' : 'No waitlist submissions recorded yet.'}
                        </td>
                      </tr>
                    ) : (
                      waitlistUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-cyan-950/20 transition-colors">
                          <td className="py-3.5 px-4 text-slate-500">#{user.id}</td>
                          <td className="py-3.5 px-4 text-white font-medium">
                            <div className="flex items-center space-x-2">
                              <span>{user.wallet_address}</span>
                              <button
                                onClick={() => copyToClipboard(user.wallet_address, `w_${user.id}`)}
                                className="text-slate-500 hover:text-cyan-400 p-1"
                                title="Copy Address"
                              >
                                {copiedId === `w_${user.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {user.x_handle ? (
                              <span className="text-cyan-300 font-semibold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                                {user.x_handle.startsWith('@') ? user.x_handle : `@${user.x_handle}`}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {new Date(user.created_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteWaitlist(user.id)}
                              className="p-1.5 rounded text-rose-400 hover:bg-rose-950/40 transition-colors"
                              title="Delete Submission"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-cyan-500/10 flex items-center justify-between text-xs font-mono text-slate-400 bg-[#080d16]/50">
                <span>
                  Showing {waitlistUsers.length} of {waitlistTotal} entries
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={waitlistPage === 0}
                    onClick={() => setWaitlistPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={(waitlistPage + 1) * 25 >= waitlistTotal}
                    onClick={() => setWaitlistPage((p) => p + 1)}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ELIGIBLE WALLETS */}
        {activeTab === 'eligible' && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={eligibleSearch}
                  onChange={(e) => {
                    setEligibleSearch(e.target.value);
                    setEligiblePage(0);
                  }}
                  placeholder="Search whitelist wallet address (0x...)"
                  className="w-full bg-[#080e18] border border-cyan-500/20 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-teal-400"
                />
                <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-cyan-950/70 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-900/50 font-mono text-xs uppercase tracking-wider flex items-center space-x-1.5 font-semibold"
                >
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>Add Wallet</span>
                </button>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 hover:shadow-teal-glow transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload CSV</span>
                </button>
              </div>
            </div>

            {/* Eligible Wallets Table */}
            <div className="glass-panel rounded-2xl border border-cyan-500/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#080d16] border-b border-cyan-500/20 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4"># ID</th>
                      <th className="py-3.5 px-4">Wallet Address</th>
                      <th className="py-3.5 px-4">Allocation</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Added On</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10">
                    {eligibleLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-400" />
                          <span>Loading Whitelist Wallets...</span>
                        </td>
                      </tr>
                    ) : eligibleWallets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          {eligibleSearch ? 'No matching eligible wallets found.' : 'No eligible wallets added yet.'}
                        </td>
                      </tr>
                    ) : (
                      eligibleWallets.map((wallet) => (
                        <tr key={wallet.id} className="hover:bg-teal-950/20 transition-colors">
                          <td className="py-3.5 px-4 text-slate-500">#{wallet.id}</td>
                          <td className="py-3.5 px-4 text-white font-medium">
                            <div className="flex items-center space-x-2">
                              <span>{wallet.wallet_address}</span>
                              <button
                                onClick={() => copyToClipboard(wallet.wallet_address, `e_${wallet.id}`)}
                                className="text-slate-500 hover:text-teal-400 p-1"
                                title="Copy Address"
                              >
                                {copiedId === `e_${wallet.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-400/40 text-cyan-300 font-bold">
                              {wallet.allocation} NFT{wallet.allocation > 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-emerald-400 font-semibold uppercase">
                              ● {wallet.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {new Date(wallet.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingWallet(wallet);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 rounded text-cyan-400 hover:bg-cyan-950/40 transition-colors"
                              title="Edit Allocation"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEligible(wallet.id)}
                              className="p-1.5 rounded text-rose-400 hover:bg-rose-950/40 transition-colors"
                              title="Delete Wallet"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-cyan-500/10 flex items-center justify-between text-xs font-mono text-slate-400 bg-[#080d16]/50">
                <span>
                  Showing {eligibleWallets.length} of {eligibleTotal} wallets
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={eligiblePage === 0}
                    onClick={() => setEligiblePage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={(eligiblePage + 1) * 25 >= eligibleTotal}
                    onClick={() => setEligiblePage((p) => p + 1)}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WAITLIST TASKS */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <ListTodo className="w-5 h-5 text-sky-400" />
                  <span>Community Tasks Configuration</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Tasks required before users can submit their wallet to the waitlist.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setTaskTitle('');
                    setTaskType('Follow');
                    setTaskUrl('');
                    setTaskRequired(true);
                    setTaskEnabled(true);
                    setTaskOrder(String(tasks.length + 1));
                    setTaskError(null);
                    setShowAddTaskModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 hover:shadow-cyan-glow transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>

            {/* Tasks Table */}
            <div className="glass-panel rounded-2xl border border-cyan-500/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#080d16] border-b border-cyan-500/20 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Order</th>
                      <th className="py-3.5 px-4">Task Title</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Task URL</th>
                      <th className="py-3.5 px-4 text-center">Required</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Completions</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10">
                    {tasksLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                          <span>Loading Community Tasks...</span>
                        </td>
                      </tr>
                    ) : tasks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          No tasks configured. Click "Add Task" to create one.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-sky-950/20 transition-colors">
                          <td className="py-3.5 px-4 text-slate-500 font-bold">
                            #{task.display_order}
                          </td>
                          <td className="py-3.5 px-4 text-white font-medium">
                            {task.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded bg-sky-950/70 border border-sky-400/40 text-sky-300 font-bold">
                              {task.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 max-w-[200px] truncate">
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:underline flex items-center space-x-1"
                            >
                              <span className="truncate">{task.url}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleToggleTaskRequired(task)}
                              className={`px-2.5 py-0.5 rounded font-bold uppercase transition-all ${
                                task.required
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800'
                              }`}
                              title="Click to toggle Required/Optional"
                            >
                              {task.required ? 'YES' : 'OPTIONAL'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleToggleTaskEnabled(task)}
                              className={`px-2.5 py-0.5 rounded font-bold uppercase transition-all ${
                                task.enabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                  : 'bg-rose-950/30 text-rose-400 border border-rose-500/30'
                              }`}
                              title="Click to toggle Enabled/Disabled"
                            >
                              {task.enabled ? 'ON' : 'OFF'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-300 font-bold">
                            {task.completionCount || 0}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingTask(task);
                                setShowEditTaskModal(true);
                              }}
                              className="p-1.5 rounded text-sky-400 hover:bg-sky-950/40 transition-colors"
                              title="Edit Task"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 rounded text-rose-400 hover:bg-rose-950/40 transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD WALLET MANUALLY */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-2xl border border-cyan-500/30 space-y-5">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <h3 className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>Add Eligible Wallet</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddWallet} className="space-y-4 font-mono text-xs">
                <div className="space-y-1.5">
                  <label className="text-cyan-300 font-semibold uppercase">Wallet Address</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="0x71C63397e3E79401736b43Fa9FE4B952E8C0409A"
                    required
                    className="w-full bg-[#080e18] border border-cyan-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-cyan-300 font-semibold uppercase">Allocation (NFTs)</label>
                  <input
                    type="number"
                    min="1"
                    value={newAllocation}
                    onChange={(e) => setNewAllocation(e.target.value)}
                    required
                    className="w-full bg-[#080e18] border border-cyan-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {addError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                    {addError}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-bold uppercase"
                  >
                    Add Wallet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT WALLET */}
        {showEditModal && editingWallet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-cyan-500/30 space-y-5">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <h3 className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <Edit2 className="w-4 h-4 text-cyan-400" />
                  <span>Edit Eligible Wallet</span>
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateWallet} className="space-y-4 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Address:</span>
                  <div className="p-2.5 bg-black/50 rounded-lg text-cyan-300 break-all border border-cyan-500/20">
                    {editingWallet.wallet_address}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-cyan-300 font-semibold uppercase">Allocation</label>
                  <input
                    type="number"
                    min="1"
                    value={editingWallet.allocation}
                    onChange={(e) =>
                      setEditingWallet({
                        ...editingWallet,
                        allocation: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-[#080e18] border border-cyan-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-cyan-300 font-semibold uppercase">Status</label>
                  <select
                    value={editingWallet.status}
                    onChange={(e) =>
                      setEditingWallet({
                        ...editingWallet,
                        status: e.target.value,
                      })
                    }
                    className="w-full bg-[#080e18] border border-cyan-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-bold uppercase"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CSV UPLOAD & IMPORT REPORT */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 rounded-2xl border border-cyan-500/30 space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <h3 className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-teal-400" />
                  <span>Import Whitelist via CSV</span>
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setImportReport(null);
                    setCsvContent('');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {!importReport ? (
                <form onSubmit={handleCsvImport} className="space-y-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-slate-300 space-y-2">
                    <span className="text-cyan-400 font-bold block">CSV Format Guidelines:</span>
                    <p className="text-[11px] leading-relaxed">
                      Accepts CSV containing wallet addresses. An optional allocation column can also be included.
                    </p>
                    <pre className="p-2 bg-black/60 rounded text-[11px] text-cyan-300">
                      wallet_address,allocation&#10;0x71C63397e3E79401736b43Fa9FE4B952E8C0409A,2&#10;0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199,1
                    </pre>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-teal-300 font-semibold uppercase block">
                      Choose File or Paste Content
                    </label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="block w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-mono file:bg-teal-500/20 file:text-teal-300 hover:file:bg-teal-500/30 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 uppercase">CSV Raw Content</label>
                    <textarea
                      rows={6}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      placeholder="Paste CSV rows here..."
                      className="w-full bg-[#080e18] border border-cyan-500/30 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 uppercase">Default Allocation (if column absent)</label>
                    <input
                      type="number"
                      min="1"
                      value={csvDefaultAlloc}
                      onChange={(e) => setCsvDefaultAlloc(e.target.value)}
                      className="w-full max-w-xs bg-[#080e18] border border-cyan-500/30 rounded-xl px-4 py-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadLoading || !csvContent.trim()}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-black font-bold uppercase flex items-center space-x-1.5 disabled:opacity-40"
                    >
                      {uploadLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Process & Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Import Report Breakdown */
                <div className="space-y-5 font-mono text-xs">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                      <div className="text-2xl font-bold text-emerald-400">{importReport.successfulCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase mt-1">Successfully Imported</div>
                    </div>
                    <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl">
                      <div className="text-2xl font-bold text-amber-400">{importReport.duplicateCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase mt-1">Duplicates Skipped</div>
                    </div>
                    <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl">
                      <div className="text-2xl font-bold text-rose-400">{importReport.invalidCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase mt-1">Invalid Format</div>
                    </div>
                  </div>

                  {/* Invalid list if any */}
                  {importReport.invalid.length > 0 && (
                    <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                      <span className="text-rose-400 font-bold uppercase block">Invalid Address Entries:</span>
                      {importReport.invalid.map((inv, idx) => (
                        <div key={idx} className="text-slate-300 flex justify-between">
                          <span className="truncate max-w-xs">{inv.address}</span>
                          <span className="text-rose-400">{inv.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Duplicates list if any */}
                  {importReport.duplicates.length > 0 && (
                    <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                      <span className="text-amber-400 font-bold uppercase block">Duplicates Ignored:</span>
                      {importReport.duplicates.map((dup, idx) => (
                        <div key={idx} className="text-slate-300 truncate">
                          {dup}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setImportReport(null);
                        setCsvContent('');
                      }}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-black font-bold uppercase"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: ADD TASK */}
        {showAddTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-2xl border border-sky-500/30 space-y-5">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                <h3 className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-sky-400" />
                  <span>Add Community Task</span>
                </h3>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4 font-mono text-xs">
                <div className="space-y-1.5">
                  <label className="text-sky-300 font-semibold uppercase">Task Title</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Follow ArcStonks on X"
                    required
                    className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sky-300 font-semibold uppercase">Task Type</label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value)}
                      className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="Follow">Follow</option>
                      <option value="Like">Like</option>
                      <option value="Repost">Repost</option>
                      <option value="Comment">Comment</option>
                      <option value="Join">Join</option>
                      <option value="Visit">Visit</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sky-300 font-semibold uppercase">Display Order</label>
                    <input
                      type="number"
                      min="0"
                      value={taskOrder}
                      onChange={(e) => setTaskOrder(e.target.value)}
                      required
                      className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sky-300 font-semibold uppercase">Target URL</label>
                  <input
                    type="url"
                    value={taskUrl}
                    onChange={(e) => setTaskUrl(e.target.value)}
                    placeholder="https://x.com/ArcStonks"
                    required
                    className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskRequired}
                      onChange={(e) => setTaskRequired(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-0 bg-black/50"
                    />
                    <span className="text-slate-200">Required Task</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskEnabled}
                      onChange={(e) => setTaskEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-0 bg-black/50"
                    />
                    <span className="text-slate-200">Enabled / Active</span>
                  </label>
                </div>

                {taskError && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                    {taskError}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-bold uppercase"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT TASK */}
        {showEditTaskModal && editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-2xl border border-sky-500/30 space-y-5">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                <h3 className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <Edit2 className="w-4 h-4 text-sky-400" />
                  <span>Edit Community Task</span>
                </h3>
                <button
                  onClick={() => setShowEditTaskModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateTask} className="space-y-4 font-mono text-xs">
                <div className="space-y-1.5">
                  <label className="text-sky-300 font-semibold uppercase">Task Title</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    required
                    className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sky-300 font-semibold uppercase">Task Type</label>
                    <select
                      value={editingTask.type}
                      onChange={(e) => setEditingTask({ ...editingTask, type: e.target.value })}
                      className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="Follow">Follow</option>
                      <option value="Like">Like</option>
                      <option value="Repost">Repost</option>
                      <option value="Comment">Comment</option>
                      <option value="Join">Join</option>
                      <option value="Visit">Visit</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sky-300 font-semibold uppercase">Display Order</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTask.display_order}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, display_order: parseInt(e.target.value, 10) || 0 })
                      }
                      required
                      className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sky-300 font-semibold uppercase">Target URL</label>
                  <input
                    type="url"
                    value={editingTask.url}
                    onChange={(e) => setEditingTask({ ...editingTask, url: e.target.value })}
                    required
                    className="w-full bg-[#080e18] border border-sky-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingTask.required)}
                      onChange={(e) => setEditingTask({ ...editingTask, required: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-0 bg-black/50"
                    />
                    <span className="text-slate-200">Required Task</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingTask.enabled)}
                      onChange={(e) => setEditingTask({ ...editingTask, enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-0 bg-black/50"
                    />
                    <span className="text-slate-200">Enabled / Active</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditTaskModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-black font-bold uppercase"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
