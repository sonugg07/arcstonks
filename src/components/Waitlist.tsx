'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Sparkles, AlertCircle, CheckCircle2, Lock, ArrowRight, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import AntiBotChallenge from './AntiBotChallenge';
import CommunityTasks from './CommunityTasks';
import { isValidEvmAddress } from '@/lib/validation';

export default function Waitlist() {
  const [address, setAddress] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [waitlistEnabled, setWaitlistEnabled] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ message: string; alreadyExists: boolean } | null>(null);

  // Community Tasks state
  const [allTasksCompleted, setAllTasksCompleted] = useState(false);
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, requiredTotal: 0, completedRequired: 0 });

  const handleTasksUpdated = useCallback((allRequired: boolean, stats: { total: number; completed: number; requiredTotal: number; completedRequired: number }) => {
    setAllTasksCompleted(allRequired);
    setTaskStats(stats);
  }, []);

  // Check waitlist enabled status from server
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setWaitlistEnabled(data.waitlist_enabled);
      }
    } catch {
      setWaitlistEnabled(true);
    }
  };

  // Check waitlist enabled status and hydrate saved registration from server
  useEffect(() => {
    fetchSettings();

    if (typeof window !== 'undefined') {
      const savedWallet = localStorage.getItem('arc_waitlist_wallet');
      const savedHandle = localStorage.getItem('arc_waitlist_x_handle');
      if (savedHandle) {
        setXHandle(savedHandle);
      }
      if (savedWallet && isValidEvmAddress(savedWallet)) {
        setAddress(savedWallet);
        if (localStorage.getItem('arc_waitlist_submitted') === 'true') {
          setSuccessData({
            message: 'Welcome to the ArcStonks Waitlist! Your wallet has been successfully recorded.',
            alreadyExists: true,
          });
        }
        // Verify with server: is this wallet currently on the waitlist in DB?
        fetch(`/api/waitlist?address=${encodeURIComponent(savedWallet)}`, { cache: 'no-store' })
          .then(res => res.json())
          .then(data => {
            if (data.registered && data.entry) {
              setSuccessData({
                message: 'Welcome to the ArcStonks Waitlist! Your wallet has been successfully recorded.',
                alreadyExists: true,
              });
              if (data.entry.x_handle) {
                setXHandle(data.entry.x_handle);
              }
            } else {
              // If admin deleted the wallet, clear saved state so user can submit again
              localStorage.removeItem('arc_waitlist_wallet');
              localStorage.removeItem('arc_waitlist_submitted');
              setSuccessData(null);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
    setIsVerified(true);
    setErrorMsg(null);
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken('');
    setIsVerified(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessData(null);

    const trimmed = address.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your EVM wallet address.');
      return;
    }

    if (!isValidEvmAddress(trimmed)) {
      setErrorMsg('Please enter a valid 0x EVM wallet address (42 characters).');
      return;
    }

    if (!allTasksCompleted) {
      setErrorMsg('Please complete all required community tasks before submitting.');
      return;
    }

    if (!isVerified || !captchaToken) {
      setErrorMsg('Anti-bot verification required before submitting.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: trimmed,
          captchaToken,
          xHandle: xHandle.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit to waitlist.');
      }

      setSuccessData({
        message: data.message,
        alreadyExists: data.alreadyExists || false,
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('arc_waitlist_wallet', trimmed);
        if (xHandle.trim()) {
          localStorage.setItem('arc_waitlist_x_handle', xHandle.trim());
        }
        localStorage.setItem('arc_waitlist_submitted', 'true');
      }

      // Trigger celebration confetti if new submission!
      if (!data.alreadyExists) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#00f0ff', '#00ffcc', '#ffffff'],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="waitlist" className="py-20 md:py-28 relative border-t border-cyan-500/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 font-mono text-xs uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Community Onboarding</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Join the <span className="text-cyan-400 glow-cyan">ArcStonks Waitlist</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Secure your spot for the 4,444 ArcStonks collection. Submissions are protected by anti-bot verification and stored persistently.
          </p>
        </div>

        {/* Waitlist Box */}
        <div className="glass-panel rounded-2xl p-6 sm:p-10 border border-cyan-500/25 box-glow-cyan">
          {waitlistEnabled === false ? (
            /* Waitlist Closed State */
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Waitlist Is Currently Closed
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Submissions have been paused by the ArcStonks team. Please follow our official social channels to be notified when the waitlist reopens.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={fetchSettings}
                  className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-cyan-500/20"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          ) : successData ? (
            /* Success State */
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                {successData.alreadyExists ? 'Already Registered!' : 'You Are On The Waitlist!'}
              </h3>
              <p className="text-slate-300 text-sm max-w-md mx-auto">
                {successData.message}
              </p>

              <div className="p-4 rounded-xl bg-black/50 border border-cyan-500/20 max-w-md mx-auto font-mono text-xs text-slate-400 space-y-2">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase mb-0.5">Registered Address:</div>
                  <div className="text-cyan-300 break-all font-semibold">{address}</div>
                </div>
                {xHandle && (
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase mb-0.5">Verified X Handle:</div>
                    <div className="text-emerald-400 font-semibold">{xHandle.startsWith('@') ? xHandle : `@${xHandle}`}</div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('arc_waitlist_wallet');
                      localStorage.removeItem('arc_waitlist_x_handle');
                      localStorage.removeItem('arc_waitlist_submitted');
                    }
                    setSuccessData(null);
                    setAddress('');
                    setXHandle('');
                    setIsVerified(false);
                    setCaptchaToken('');
                  }}
                  className="px-5 py-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-xs font-mono text-cyan-300"
                >
                  Register Another Wallet
                </button>
                <a
                  href="#checker"
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 text-black text-xs font-mono font-bold uppercase tracking-wider"
                >
                  Check Wallet Status
                </a>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Community Tasks Section */}
              <CommunityTasks
                walletAddress={address}
                xHandle={xHandle}
                onXHandleChange={setXHandle}
                onTasksUpdated={handleTasksUpdated}
              />

              {/* 2. Wallet Address Input */}
              <div className="space-y-2 pt-3 border-t border-cyan-500/15">
                <label htmlFor="walletAddress" className="block text-xs font-mono font-semibold uppercase text-cyan-300 tracking-wider">
                  Wallet Address
                </label>
                <div className="relative">
                  <input
                    id="walletAddress"
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="0x71C... (EVM address)"
                    autoComplete="off"
                    spellCheck="false"
                    className="w-full bg-[#070e17] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-3.5 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                  {address && (
                    <div className="absolute right-3 top-3.5 text-xs font-mono">
                      {isValidEvmAddress(address) ? (
                        <span className="text-emerald-400 flex items-center space-x-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Valid</span>
                        </span>
                      ) : (
                        <span className="text-amber-400">Invalid 0x format</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Enter your public EVM address. No seed phrases or private keys will ever be requested.
                </p>
              </div>

              {/* 3. Anti-Bot Verification / CAPTCHA */}
              <div className="space-y-2">
                <AntiBotChallenge
                  onVerify={handleCaptchaVerify}
                  onExpire={handleCaptchaExpire}
                  isVerified={isVerified}
                />
              </div>

              {/* Error Display */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 font-mono">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !address || (taskStats.requiredTotal > 0 && !allTasksCompleted) || !isVerified}
                className={`w-full py-4 rounded-xl font-mono font-bold text-sm tracking-wider uppercase flex items-center justify-center space-x-2 transition-all duration-300 ${
                  loading || !address || (taskStats.requiredTotal > 0 && !allTasksCompleted) || !isVerified
                    ? 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-black hover:shadow-cyan-glow transform active:scale-98 cursor-pointer'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying & Submitting...</span>
                  </>
                ) : !address ? (
                  <span>Enter Wallet Address Above</span>
                ) : taskStats.requiredTotal > 0 && !allTasksCompleted ? (
                  <span>Complete Required Tasks ({taskStats.completedRequired}/{taskStats.requiredTotal})</span>
                ) : !isVerified ? (
                  <span>Complete Anti-Bot Verification</span>
                ) : (
                  <>
                    <span>✓ Join Waitlist</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center space-x-4 text-[11px] font-mono text-slate-400 pt-1">
                <span>• 100% Persistent Storage</span>
                <span>• Anti-Bot Shield</span>
                <span>• Zero Wallet Connect</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
