'use client';

import React from 'react';
import Image from 'next/image';
import { Sparkles, ArrowRight, CheckCircle2, Flame, Layers, Users, ExternalLink } from 'lucide-react';
import CandlestickChart from './CandlestickChart';

export default function Hero() {
  return (
    <section id="home" className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      {/* Background neon elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Visual Banner Showcase */}
        <div className="mb-10 relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-cyan-glow group">
          <div className="relative aspect-[2/1] sm:aspect-[2.4/1] md:aspect-[3/1] w-full">
            <Image
              src="/images/arcstonks-banner.png"
              alt="ArcStonks Visual Banner"
              fill
              priority
              className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-700"
            />
            {/* Gradient edge fades */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#06090e] via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#06090e]/40 via-transparent to-[#06090e]/40" />
          </div>
          <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-cyan-400/40 text-cyan-300 font-mono text-[11px] flex items-center space-x-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>OFFICIAL FLAGSHIP COLLECTION</span>
            </span>
          </div>
        </div>

        {/* Hero Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Typography & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Arc Tag */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <Flame className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
              <span>Built Exclusively for the Arc Ecosystem</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Community Powering The{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-white glow-cyan">
                Arc Ecosystem.
              </span>
            </h1>

            {/* Tagline */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
              <strong className="text-cyan-300 font-semibold">ArcStonks</strong> is the premier 4,444 piece digital artifact collection engineered for unstoppable community momentum. Clean aesthetics, fair distribution, and deep ecosystem alignment.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#waitlist"
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-mono font-bold text-sm tracking-wider uppercase hover:shadow-cyan-glow transition-all duration-300 flex items-center space-x-2 transform active:scale-95"
              >
                <span>Join Waitlist</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="#checker"
                className="px-7 py-3.5 rounded-xl bg-[#0c131d] border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 font-mono font-bold text-sm tracking-wider uppercase hover:bg-cyan-950/30 transition-all duration-300 flex items-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>Check Wallet</span>
              </a>
            </div>

            {/* Social / Ecosystem Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs font-mono text-slate-400">
              <span className="flex items-center space-x-1.5 hover:text-cyan-300 transition-colors">
                <span className="text-cyan-400 font-bold">X</span>
                <span>/ Twitter</span>
              </span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center space-x-1.5 hover:text-cyan-300 transition-colors">
                <span className="text-cyan-400 font-bold">DISCORD</span>
                <span>Community</span>
              </span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center space-x-1.5 hover:text-cyan-300 transition-colors">
                <span className="text-cyan-400 font-bold">ARC</span>
                <span>Network</span>
              </span>
            </div>
          </div>

          {/* Right Column: Candlestick Stonks Indicator & Stats */}
          <div className="lg:col-span-5 space-y-6">
            <CandlestickChart />

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 text-center">
                <div className="flex items-center justify-center text-cyan-400 mb-1">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-lg font-bold text-white font-mono">4,444</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Total Supply</div>
              </div>

              <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 text-center">
                <div className="flex items-center justify-center text-teal-400 mb-1">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-lg font-bold text-white font-mono">100%</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Original Art</div>
              </div>

              <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 text-center">
                <div className="flex items-center justify-center text-emerald-400 mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-lg font-bold text-white font-mono">Fair</div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Distribution</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
