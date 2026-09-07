'use client';

import React from 'react';
import { Shield, Sparkles, Cpu, Target, Network, Compass } from 'lucide-react';

export default function About() {
  const pillars = [
    {
      icon: <Network className="w-6 h-6 text-cyan-400" />,
      title: 'Arc Ecosystem Integration',
      description:
        'Engineered to be an active cultural and social pillar of the Arc network, collaborating with early builders, protocols, and creators across the ecosystem.',
    },
    {
      icon: <Cpu className="w-6 h-6 text-teal-400" />,
      title: '4,444 Provably Scarce NFTs',
      description:
        'A capped, non-dilutable supply of 4,444 distinct generative cyber-pixel artifacts. Every piece is generated with meticulously curated visual traits and cyber attributes.',
    },
    {
      icon: <Target className="w-6 h-6 text-cyan-300" />,
      title: 'Community-First Ethos',
      description:
        'Real decentralization begins with engaged community members. Whitelist distribution, fair access, and transparent development are baked into our DNA from day one.',
    },
    {
      icon: <Compass className="w-6 h-6 text-emerald-400" />,
      title: 'Sustainable Long-Term Vision',
      description:
        'We focus on steady, sustainable building rather than temporary market noise. We are dedicated to creating genuine utility, digital identity, and ecosystem alignment.',
    },
  ];

  return (
    <section id="about" className="py-20 md:py-28 relative border-t border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 font-mono text-xs uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Origins & Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            About <span className="text-cyan-400 glow-cyan">ArcStonks</span>
          </h2>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            ArcStonks is a community-focused NFT project built around the Arc ecosystem, centered around a 4,444 NFT collection and designed to grow into a broader community-driven ecosystem.
          </p>
        </div>

        {/* Narrative Feature Highlight */}
        <div className="glass-panel rounded-2xl p-8 md:p-12 mb-12 border border-cyan-500/20 box-glow-cyan">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block">
                The Arc Ecosystem Story
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
                More Than Collectibles. A Culture of Builders & Believers.
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                As the Arc ecosystem expands with new decentralized infrastructure, apps, and liquidity, ArcStonks serves as the digital identity and connective tissue for active participants. 
              </p>
              <p className="text-slate-400 text-sm leading-relaxed">
                We believe the most enduring Web3 projects are founded on transparent principles, organic camaraderie, and long-term utility that grows in lockstep with the host network.
              </p>
            </div>

            <div className="bg-[#080e18] p-6 rounded-xl border border-cyan-500/20 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
                <span className="text-slate-400">Total Collection Size:</span>
                <span className="text-cyan-300 font-bold">4,444 Items</span>
              </div>
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
                <span className="text-slate-400">Ecosystem:</span>
                <span className="text-teal-300 font-bold">Arc Network</span>
              </div>
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
                <span className="text-slate-400">Access Mode:</span>
                <span className="text-white font-bold">Fair Waitlist & Whitelist</span>
              </div>
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
                <span className="text-slate-400">Anti-Bot Protection:</span>
                <span className="text-emerald-400 font-bold">Server Verified CAPTCHA</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Philosophy:</span>
                <span className="text-cyan-400 font-bold">Community-First Growth</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar, idx) => (
            <div
              key={idx}
              className="glass-panel p-6 rounded-xl border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300 space-y-3 group"
            >
              <div className="p-3 w-fit rounded-lg bg-cyan-950/50 border border-cyan-500/20 group-hover:border-cyan-400/40 transition-colors">
                {pillar.icon}
              </div>
              <h4 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                {pillar.title}
              </h4>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
