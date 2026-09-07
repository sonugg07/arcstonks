'use client';

import React, { useState } from 'react';
import { Sparkles, Shield, Cpu, Tag, Eye } from 'lucide-react';

interface NFTItem {
  id: string;
  name: string;
  rarity: 'Mythic' | 'Legendary' | 'Epic' | 'Rare';
  archetype: string;
  glowColor: string;
  borderColor: string;
  badgeBg: string;
  accent: string;
  traits: { label: string; val: string }[];
}

export default function ArtworkShowcase() {
  const [selectedRarity, setSelectedRarity] = useState<string>('All');

  const nfts: NFTItem[] = [
    {
      id: '#0001',
      name: 'Arc Keymaster',
      rarity: 'Mythic',
      archetype: 'Genesis Holder',
      glowColor: 'rgba(0, 240, 255, 0.4)',
      borderColor: 'border-cyan-400',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      accent: 'from-cyan-500 to-blue-600',
      traits: [
        { label: 'Aura', val: 'Cyber Arc Glow' },
        { label: 'Accessory', val: 'Pixel Masterkey' },
        { label: 'Momentum', val: '99.9%' },
      ],
    },
    {
      id: '#0777',
      name: 'Bullish Stonker',
      rarity: 'Legendary',
      archetype: 'Market Navigator',
      glowColor: 'rgba(0, 255, 204, 0.4)',
      borderColor: 'border-teal-400',
      badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-400/40',
      accent: 'from-teal-400 to-emerald-600',
      traits: [
        { label: 'Expression', val: 'Ultra Bullish' },
        { label: 'Chart', val: 'Green Candlestick' },
        { label: 'Momentum', val: '98.2%' },
      ],
    },
    {
      id: '#1337',
      name: 'Neon Whale',
      rarity: 'Epic',
      archetype: 'Liquidity Provider',
      glowColor: 'rgba(56, 189, 248, 0.4)',
      borderColor: 'border-sky-400',
      badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
      accent: 'from-sky-400 to-indigo-600',
      traits: [
        { label: 'Headwear', val: 'Holo Visor' },
        { label: 'Skin', val: 'Neon Circuit' },
        { label: 'Momentum', val: '94.5%' },
      ],
    },
    {
      id: '#2048',
      name: 'Diamond Sentinel',
      rarity: 'Rare',
      archetype: 'Vault Guardian',
      glowColor: 'rgba(147, 51, 234, 0.4)',
      borderColor: 'border-purple-400',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
      accent: 'from-purple-500 to-pink-600',
      traits: [
        { label: 'Armor', val: 'Obsidian Plate' },
        { label: 'Hands', val: 'Diamond Shards' },
        { label: 'Momentum', val: '91.0%' },
      ],
    },
    {
      id: '#4444',
      name: 'Arc Singularity',
      rarity: 'Mythic',
      archetype: 'Ecosystem Core',
      glowColor: 'rgba(0, 240, 255, 0.5)',
      borderColor: 'border-cyan-300',
      badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-300/50',
      accent: 'from-cyan-400 via-teal-300 to-white',
      traits: [
        { label: 'Core', val: 'Quantum Matrix' },
        { label: 'Special', val: 'Final Stonker' },
        { label: 'Momentum', val: '100.0%' },
      ],
    },
  ];

  const filtered = selectedRarity === 'All'
    ? nfts
    : nfts.filter((nft) => nft.rarity === selectedRarity);

  return (
    <section className="py-20 relative border-t border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generative Cyber Pixel Series</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              NFT Artwork <span className="text-cyan-400 glow-cyan">Showcase</span>
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              Preview of traits and archetypes within the 4,444 ArcStonks generative collection.
            </p>
          </div>

          {/* Rarity Filter Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 font-mono text-xs">
            {['All', 'Mythic', 'Legendary', 'Epic', 'Rare'].map((rarity) => (
              <button
                key={rarity}
                onClick={() => setSelectedRarity(rarity)}
                className={`px-3.5 py-1.5 rounded-lg border transition-all ${
                  selectedRarity === rarity
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                    : 'bg-[#080e18] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>

        {/* NFT Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {filtered.map((nft) => (
            <div
              key={nft.id}
              className={`glass-panel rounded-xl overflow-hidden border ${nft.borderColor}/30 hover:${nft.borderColor} transition-all duration-300 hover:-translate-y-1.5 group`}
              style={{
                boxShadow: `0 4px 20px ${nft.glowColor}`,
              }}
            >
              {/* Visual Card Top / Pixel Graphic */}
              <div className="relative aspect-square bg-[#050912] flex items-center justify-center p-6 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${nft.accent} opacity-15 group-hover:opacity-30 transition-opacity`} />
                <div className="cyber-grid absolute inset-0 opacity-40" />

                {/* Pixel Character Motif */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-black/80 to-slate-900 border border-cyan-500/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="pixel-text text-2xl text-cyan-400 font-bold glow-cyan">
                      ▲
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="pixel-text text-[10px] text-slate-200 tracking-wider block">
                      ARC•{nft.id}
                    </span>
                  </div>
                </div>

                {/* Rarity Badge */}
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${nft.badgeBg}`}>
                    {nft.rarity}
                  </span>
                </div>

                <div className="absolute top-3 right-3 text-slate-400 text-xs font-mono">
                  {nft.id}
                </div>
              </div>

              {/* Details & Traits */}
              <div className="p-4 space-y-3 bg-[#0a111c]/90 border-t border-cyan-500/10">
                <div>
                  <h4 className="font-bold text-white text-base group-hover:text-cyan-300 transition-colors">
                    {nft.name}
                  </h4>
                  <span className="text-xs font-mono text-slate-400 block">
                    {nft.archetype}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-800 font-mono text-[11px]">
                  {nft.traits.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-400">
                      <span>{t.label}:</span>
                      <span className="text-slate-200 font-medium">{t.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
