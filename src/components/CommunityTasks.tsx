'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Twitter,
  Heart,
  Repeat2,
  MessageSquare,
  UserPlus,
  Compass,
  Loader2,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { PublicTaskItem } from '@/lib/types';
import { isValidEvmAddress } from '@/lib/validation';

interface CommunityTasksProps {
  walletAddress: string;
  xHandle: string;
  onXHandleChange: (handle: string) => void;
  onTasksUpdated: (allRequiredCompleted: boolean, stats: { total: number; completed: number; requiredTotal: number; completedRequired: number }) => void;
}

export default function CommunityTasks({
  walletAddress,
  xHandle,
  onXHandleChange,
  onTasksUpdated,
}: CommunityTasksProps) {
  const [tasks, setTasks] = useState<PublicTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [startedTasks, setStartedTasks] = useState<Record<number, boolean>>({});
  const [actionTimestamps, setActionTimestamps] = useState<Record<number, number>>({});
  const [countdowns, setCountdowns] = useState<Record<number, number>>({});
  const [verifyingTasks, setVerifyingTasks] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isWalletValid = isValidEvmAddress(walletAddress);

  // Countdown timer effect
  useEffect(() => {
    const hasActiveCountdown = Object.values(countdowns).some(c => c > 0);
    if (!hasActiveCountdown) return;

    const timer = setInterval(() => {
      setCountdowns(prev => {
        const next: Record<number, number> = {};
        for (const [id, count] of Object.entries(prev)) {
          if (count > 1) {
            next[Number(id)] = count - 1;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdowns]);

  // Fetch tasks on mount or retry
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      } else {
        setFetchError('Failed to load community tasks from server.');
      }
    } catch (err) {
      console.error('Failed to fetch tasks', err);
      setFetchError('Network error connecting to tasks API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // When a valid wallet is entered, quietly check completion status in background
  useEffect(() => {
    if (isWalletValid) {
      fetch(`/api/tasks?address=${encodeURIComponent(walletAddress.trim())}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (data.tasks) {
            setTasks(data.tasks);
          }
        })
        .catch(() => {});
    }
  }, [walletAddress, isWalletValid]);

  // Evaluate required completion and notify parent
  useEffect(() => {
    const requiredTasks = tasks.filter(t => t.required);
    const completedRequired = requiredTasks.filter(t => t.completed).length;
    const allRequiredCompleted = requiredTasks.length === 0 || completedRequired === requiredTasks.length;

    onTasksUpdated(allRequiredCompleted, {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      requiredTotal: requiredTasks.length,
      completedRequired,
    });
  }, [tasks, onTasksUpdated]);

  // Handle clicking task action link
  const handleActionClick = (task: PublicTaskItem) => {
    // Open task URL
    if (task.url) {
      window.open(task.url, '_blank', 'noopener,noreferrer');
    }
    // Mark as started with timestamp and 4s cooldown
    const now = Date.now();
    setStartedTasks(prev => ({ ...prev, [task.id]: true }));
    setActionTimestamps(prev => ({ ...prev, [task.id]: now }));
    setCountdowns(prev => ({ ...prev, [task.id]: 4 }));
    setErrorMsg(null);
  };

  // Handle user verification click
  const handleVerifyClick = async (task: PublicTaskItem) => {
    if (!isWalletValid) {
      setErrorMsg('Please enter your EVM wallet address below to verify task completion.');
      const el = document.getElementById('walletAddress');
      if (el) el.focus();
      return;
    }

    const trimmedHandle = xHandle.trim();
    if (!trimmedHandle) {
      setErrorMsg('Please enter your X (Twitter) username (@username) above so we can verify your action.');
      const el = document.getElementById('xHandle');
      if (el) el.focus();
      return;
    }

    if (!startedTasks[task.id]) {
      setErrorMsg(`Please click the '${task.type} on X' button first to perform the action on X.`);
      return;
    }

    if (countdowns[task.id] && countdowns[task.id] > 0) {
      setErrorMsg(`Action in progress on X. Please wait ${countdowns[task.id]}s before verifying.`);
      return;
    }

    setVerifyingTasks(prev => ({ ...prev, [task.id]: true }));
    setErrorMsg(null);

    try {
      const res = await fetch('/api/tasks/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress.trim(),
          taskId: task.id,
          proof: trimmedHandle,
          actionOpenedAt: actionTimestamps[task.id] || Date.now() - 5000,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Task verification failed');
      }

      // Update local task completion state
      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { 
          ...t, 
          completed: true, 
          verified_at: data.verifiedAt,
          proof_value: data.proof || trimmedHandle,
        } : t))
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying task completion.');
    } finally {
      setVerifyingTasks(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const getTaskIcon = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('follow')) return <UserPlus className="w-4 h-4 text-cyan-400" />;
    if (lower.includes('like')) return <Heart className="w-4 h-4 text-rose-400" />;
    if (lower.includes('repost') || lower.includes('retweet')) return <Repeat2 className="w-4 h-4 text-emerald-400" />;
    if (lower.includes('comment') || lower.includes('reply')) return <MessageSquare className="w-4 h-4 text-teal-300" />;
    return <Twitter className="w-4 h-4 text-sky-400" />;
  };

  const requiredTasks = tasks.filter(t => t.required);
  const completedRequired = requiredTasks.filter(t => t.completed).length;
  const allRequiredDone = requiredTasks.length > 0 && completedRequired === requiredTasks.length;

  if (loading && tasks.length === 0) {
    return (
      <div className="py-6 flex items-center justify-center space-x-2 text-xs font-mono text-cyan-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading Community Tasks...</span>
      </div>
    );
  }

  if (fetchError && tasks.length === 0) {
    return (
      <div className="py-6 text-center space-y-3 border border-rose-500/30 rounded-xl bg-rose-950/20 p-4 font-mono text-xs text-rose-300">
        <div>{fetchError}</div>
        <button
          type="button"
          onClick={fetchTasks}
          className="px-4 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-xs font-mono"
        >
          Retry Loading Tasks
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-6 text-center border border-cyan-500/20 rounded-xl bg-slate-950/40 p-4 font-mono text-xs text-slate-400">
        No community tasks available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/10 pb-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-mono font-bold text-cyan-300">
            Community Tasks
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-400">
            {requiredTasks.length} Required
          </span>
        </div>

        <div className="text-xs font-mono text-slate-400 flex items-center space-x-2">
          <span>Progress:</span>
          <span className={`font-bold ${allRequiredDone ? 'text-emerald-400' : 'text-cyan-300'}`}>
            {completedRequired} / {requiredTasks.length} Completed
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/20">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-500"
          style={{
            width: requiredTasks.length > 0 ? `${(completedRequired / requiredTasks.length) * 100}%` : '100%',
          }}
        />
      </div>

      {/* X / Twitter Handle Input Card */}
      <div className="p-4 rounded-xl bg-[#080d16] border border-cyan-500/25 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Twitter className="w-4 h-4 text-cyan-400" />
            <label htmlFor="xHandle" className="text-xs font-mono font-bold uppercase text-white tracking-wider">
              Your X (Twitter) Username
            </label>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
            Required for Proof
          </span>
        </div>

        <div className="relative">
          <input
            id="xHandle"
            type="text"
            value={xHandle}
            onChange={(e) => {
              const val = e.target.value;
              onXHandleChange(val);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="@your_x_handle (e.g. @arc_stonker)"
            autoComplete="off"
            spellCheck="false"
            className="w-full bg-[#050910] border border-cyan-500/30 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
          />
        </div>

        <p className="text-[11px] text-slate-400 font-mono">
          • Enter your genuine X handle. Each X account can only be verified with 1 wallet entry (Anti-Sybil).
        </p>
      </div>

      {/* Wallet requirement hint if empty */}
      {!isWalletValid && (
        <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px] font-mono text-cyan-300 flex items-center space-x-2">
          <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
          <span>Complete tasks above, then enter your EVM wallet address below to verify completions.</span>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-2.5">
        {tasks.map((task, idx) => {
          const isStarted = startedTasks[task.id] || task.completed;
          const isVerifying = verifyingTasks[task.id] || false;
          const currentCountdown = countdowns[task.id] || 0;
          const formattedIdx = String(idx + 1).padStart(2, '0');

          return (
            <div
              key={task.id}
              className={`p-3.5 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                task.completed
                  ? 'bg-emerald-950/20 border-emerald-500/30 shadow-sm'
                  : isStarted
                  ? 'bg-[#080e18] border-cyan-500/40 shadow-sm'
                  : 'bg-[#070c14] border-cyan-500/15 hover:border-cyan-500/30'
              }`}
            >
              {/* Task Title & Details */}
              <div className="flex items-start sm:items-center space-x-3">
                <span className="font-mono text-xs font-bold text-slate-500 pt-0.5 sm:pt-0">
                  {formattedIdx}
                </span>

                <div className="p-2 rounded-lg bg-black/50 border border-cyan-500/20">
                  {getTaskIcon(task.type)}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs sm:text-sm font-semibold text-white">
                      {task.title}
                    </span>
                    {task.required ? (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-[9px] font-mono text-cyan-300 font-bold uppercase">
                        Required
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[9px] font-mono text-slate-400 uppercase">
                        Optional
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-[11px] font-mono text-slate-400">
                      Action Type: <strong className="text-cyan-400">{task.type}</strong>
                    </span>
                    {task.proof_value && (
                      <span className="text-[10px] font-mono text-emerald-400/90 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        {task.proof_value}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action & Verification Controls */}
              <div className="flex items-center space-x-2 self-end sm:self-center font-mono text-xs">
                {task.completed ? (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verified</span>
                  </div>
                ) : (
                  <>
                    {/* Step 1: Open/Perform Action */}
                    <button
                      type="button"
                      onClick={() => handleActionClick(task)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 hover:text-white transition-all flex items-center space-x-1"
                    >
                      <span>{task.type} on X</span>
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                    </button>

                    {/* Step 2: Verify Action */}
                    <button
                      type="button"
                      disabled={isVerifying || !isWalletValid}
                      onClick={() => handleVerifyClick(task)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                        currentCountdown > 0
                          ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                          : isStarted && xHandle.trim()
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-400 text-black hover:shadow-teal-glow active:scale-95'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                      }`}
                      title={!isStarted ? 'Click action button first to perform the task' : 'Verify completion'}
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : currentCountdown > 0 ? (
                        <>
                          <Clock className="w-3 h-3 animate-pulse" />
                          <span>Wait {currentCountdown}s</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verify</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Status Summary */}
      <div className="p-3 rounded-xl bg-[#080d16] border border-cyan-500/20 font-mono text-xs text-slate-300 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Required Tasks Checklist:</span>
          <span className={allRequiredDone ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {allRequiredDone ? '✓ All required tasks completed' : `○ ${requiredTasks.length - completedRequired} required remaining`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 text-[11px]">
          {requiredTasks.map(t => (
            <div key={t.id} className="flex items-center space-x-1.5">
              {t.completed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              )}
              <span className={t.completed ? 'text-emerald-300' : 'text-slate-400 truncate'}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
