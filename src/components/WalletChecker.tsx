'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, AlertCircle, Loader2, Sparkles, Lock } from 'lucide-react';
import { isValidEvmAddress } from '@/lib/validation';

export default function WalletChecker() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkerEnabled, setCheckerEnabled] = useState<boolean | null>(null);
  const [result, setResult] = useState<{
    searched: boolean;
    eligible: boolean;
    allocation?: number;
    status?: string;
    message?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch settings to check if checker is enabled
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCheckerEnabled(data.checker_enabled);
      }
    } catch {
      setCheckerEnabled(true);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResult(null);

    const trimmed = address.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a wallet address.');
      return;
    }

    if (!isValidEvmAddress(trimmed)) {
      setErrorMsg('Invalid EVM wallet address format. Address must start with 0x and contain 40 hexadecimal characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/check-wallet?address=${encodeURIComponent(trimmed)}`, {
        cache: 'no-store',
      });

      const data = await res.json();

      if (res.status === 503) {
        setCheckerEnabled(false);
        setErrorMsg('Wallet Checker is currently unavailable.');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify eligibility.');
      }

      setResult({
        searched: true,
        eligible: data.eligible,
        allocation: data.allocation,
        status: data.status,
        message: data.message,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with verification node.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="checker" className="py-20 md:py-28 relative border-t border-cyan-500/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 font-mono text-xs uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Eligibility Verification</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Check Your <span className="text-cyan-400 glow-cyan">Wallet</span>
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Verify whether your wallet has been approved for the ArcStonks whitelist allocation. No wallet connection or signature required.
          </p>
        </div>

        {/* Checker Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-10 border border-cyan-500/25 box-glow-cyan">
          {checkerEnabled === false ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Wallet Checker is currently unavailable.
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                The eligibility checker has been temporarily disabled by the ArcStonks team for list updates. Please check back shortly.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={fetchSettings}
                  className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-cyan-500/20"
                >
                  Retry Status
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCheck} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="checkAddress" className="block text-xs font-mono font-semibold uppercase text-cyan-300 tracking-wider">
                  Enter Wallet Address
                </label>
                <div className="relative">
                  <input
                    id="checkAddress"
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                      if (result) setResult(null);
                    }}
                    placeholder="0x..."
                    autoComplete="off"
                    spellCheck="false"
                    className="w-full bg-[#070e17] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-3.5 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                  <div className="absolute right-3 top-3 text-slate-500">
                    <Search className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 font-mono">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !address}
                className={`w-full py-4 rounded-xl font-mono font-bold text-sm tracking-wider uppercase flex items-center justify-center space-x-2 transition-all duration-300 ${
                  loading || !address
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-black hover:shadow-cyan-glow transform active:scale-98 cursor-pointer'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Querying Whitelist Registry...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Check Eligibility</span>
                  </>
                )}
              </button>

              {/* Eligibility Result Card */}
              {result && (
                <div
                  className={`mt-6 p-6 rounded-xl border transition-all animate-in fade-in duration-300 ${
                    result.eligible
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="mt-0.5">
                      {result.eligible ? (
                        <CheckCircle2 className="w-7 h-7 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-7 h-7 text-rose-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-bold text-lg">
                          {result.eligible ? '✓ Eligible' : '✕ Not Eligible'}
                        </span>
                        {result.eligible && (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-bold">
                            Allocation: {result.allocation} NFT{result.allocation && result.allocation > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300">
                        {result.eligible
                          ? 'This wallet is approved on the official ArcStonks whitelist! Stay tuned for the collection mint schedule.'
                          : 'This wallet was not found on the eligible list. If you haven\'t already, make sure to submit your address to the ArcStonks Waitlist.'}
                      </p>

                      {!result.eligible && (
                        <div className="pt-2">
                          <a
                            href="#waitlist"
                            className="inline-flex items-center text-xs font-mono text-cyan-400 hover:text-cyan-300 underline font-semibold"
                          >
                            → Go to Waitlist Entry
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
