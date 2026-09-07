'use client';

import React from 'react';
import Link from 'next/link';
import { KeyRound, Shield, ExternalLink, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-cyan-500/15 bg-[#05080e] pt-16 pb-12 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-cyan-500/10">
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-4">
            <Link href="#home" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <KeyRound className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="pixel-text text-base font-bold text-white tracking-wider glow-cyan">
                ARC<span className="text-cyan-400">STONKS</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed max-w-sm text-slate-400">
              ArcStonks is a community-focused NFT project built around the Arc ecosystem, centered around a 4,444 NFT collection and designed to grow into a broader community-driven ecosystem.
            </p>
            <div className="flex items-center space-x-3 pt-2 font-mono text-xs text-cyan-400">
              <span className="px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/30">
                Supply: 4,444
              </span>
              <span className="px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/30">
                Arc Ecosystem
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-3 font-mono text-xs">
            <h4 className="text-white font-bold uppercase tracking-wider text-sm font-sans">
              Navigation
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#home" className="hover:text-cyan-400 transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-cyan-400 transition-colors">
                  About ArcStonks
                </a>
              </li>
              <li>
                <a href="#roadmap" className="hover:text-cyan-400 transition-colors">
                  Roadmap Phases
                </a>
              </li>
              <li>
                <a href="#waitlist" className="hover:text-cyan-400 transition-colors">
                  Join Waitlist
                </a>
              </li>
              <li>
                <a href="#checker" className="hover:text-cyan-400 transition-colors">
                  Wallet Checker
                </a>
              </li>
            </ul>
          </div>

          {/* Ecosystem Links */}
          <div className="md:col-span-4 space-y-3 font-mono text-xs">
            <h4 className="text-white font-bold uppercase tracking-wider text-sm font-sans">
              Ecosystem & Portal
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center space-x-1.5"
                >
                  <span>X (Twitter)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center space-x-1.5"
                >
                  <span>Discord Community</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center space-x-1.5"
                >
                  <span>Telegram Channel</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="pt-2">
                <Link
                  href="/admin"
                  className="inline-flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>ArcStonks</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-slate-400">
          <p className="max-w-xl text-center md:text-left">
            Disclaimer: ArcStonks is a community digital collectible project on the Arc network. Content on this site is not financial, legal, or investment advice.
          </p>
          <div className="flex items-center space-x-1">
            <span>© {new Date().getFullYear()} ArcStonks. Built for the Arc Ecosystem.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
