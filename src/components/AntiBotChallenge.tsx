'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Cpu, CheckCircle2 } from 'lucide-react';

interface AntiBotChallengeProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  isVerified: boolean;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: (err: any) => void;
          'expired-callback'?: () => void;
          theme?: 'dark' | 'light' | 'auto';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export default function AntiBotChallenge({ onVerify, onExpire, isVerified }: AntiBotChallengeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const [mode, setMode] = useState<'turnstile' | 'crypto_challenge'>('turnstile');
  const [challengeData, setChallengeData] = useState<{ question: string; payload: string } | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || '1x00000000000000000000AA';

  // Load Cloudflare Turnstile script
  useEffect(() => {
    let scriptLoaded = false;
    const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');

    const handleTurnstileRender = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current && mode === 'turnstile') {
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'dark',
            callback: (token: string) => {
              onVerify(token);
            },
            'error-callback': () => {
              // Fallback to cryptographic challenge
              setMode('crypto_challenge');
              loadCryptographicChallenge();
            },
            'expired-callback': () => {
              if (onExpire) onExpire();
            },
          });
        } catch {
          setMode('crypto_challenge');
          loadCryptographicChallenge();
        }
      }
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded = true;
        setTimeout(handleTurnstileRender, 200);
      };
      script.onerror = () => {
        setMode('crypto_challenge');
        loadCryptographicChallenge();
      };
      document.head.appendChild(script);
    } else {
      setTimeout(handleTurnstileRender, 200);
    }

    // Safety timeout: if Turnstile hasn't rendered in 3.5 seconds, activate interactive challenge
    const timer = setTimeout(() => {
      if (!widgetIdRef.current && !isVerified) {
        setMode('crypto_challenge');
        loadCryptographicChallenge();
      }
    }, 3500);

    return () => {
      clearTimeout(timer);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {}
      }
    };
  }, [siteKey, mode, isVerified, onVerify, onExpire]);

  // Fetch cryptographic challenge
  const loadCryptographicChallenge = async () => {
    setLoadingChallenge(true);
    setChallengeError(null);
    try {
      const res = await fetch('/api/waitlist', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch challenge');
      const data = await res.json();
      setChallengeData(data);
    } catch {
      setChallengeError('Could not contact anti-bot service.');
    } finally {
      setLoadingChallenge(false);
    }
  };

  const handleVerifyChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeData || !userAnswer.trim()) return;

    try {
      const parsedPayload = JSON.parse(atob(challengeData.payload));
      const submission = {
        ...parsedPayload,
        userAnswer: userAnswer.trim(),
      };
      const token = 'arc_challenge:' + btoa(JSON.stringify(submission));
      onVerify(token);
      setChallengeError(null);
    } catch {
      setChallengeError('Invalid challenge format');
    }
  };

  return (
    <div className="w-full bg-[#080d16] border border-cyan-500/20 rounded-xl p-4 transition-all duration-300">
      <div className="flex items-center justify-between mb-3 border-b border-cyan-500/10 pb-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="text-xs uppercase tracking-wider font-mono font-semibold text-cyan-300">
            Anti-Bot Verification
          </span>
        </div>
        {isVerified ? (
          <span className="inline-flex items-center text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Verified Human
          </span>
        ) : (
          <span className="text-xs font-mono text-slate-400">Required</span>
        )}
      </div>

      {isVerified ? (
        <div className="flex items-center space-x-3 py-2 px-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-semibold text-xs font-mono">VERIFICATION COMPLETED</div>
            <div className="text-xs text-slate-300">Security token validated by Arc anti-bot gate.</div>
          </div>
        </div>
      ) : mode === 'turnstile' ? (
        <div className="min-h-[65px] flex flex-col items-center justify-center">
          <div ref={containerRef} className="flex justify-center" />
          <div className="mt-2 flex items-center justify-between w-full text-[11px] text-slate-400 font-mono">
            <span>Powered by Cloudflare Turnstile</span>
            <button
              type="button"
              onClick={() => {
                setMode('crypto_challenge');
                loadCryptographicChallenge();
              }}
              className="text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              Alternative verification
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center space-x-1.5 font-mono">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cryptographic Proof Gate</span>
            </span>
            <button
              type="button"
              onClick={loadCryptographicChallenge}
              disabled={loadingChallenge}
              className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingChallenge ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {challengeData ? (
            <form onSubmit={handleVerifyChallenge} className="space-y-2">
              <div className="p-3 bg-slate-900/90 rounded-lg border border-cyan-500/30">
                <p className="text-xs text-cyan-200 font-mono mb-2">
                  Solve to confirm you are human: <strong className="text-white text-sm">{challengeData.question}</strong>
                </p>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Enter answer"
                    className="flex-1 bg-black/60 border border-cyan-500/40 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 text-xs font-mono font-bold rounded transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-center py-4 text-xs text-slate-400 font-mono">
              <RefreshCw className="w-3 h-3 animate-spin mr-2 text-cyan-400" />
              Loading security challenge...
            </div>
          )}

          {challengeError && (
            <div className="text-xs text-rose-400 flex items-center space-x-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{challengeError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
