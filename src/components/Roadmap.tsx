'use client';

import React from 'react';
import { Milestone, CheckCircle2, Clock, Zap, Rocket, Compass, Layers } from 'lucide-react';

export default function Roadmap() {
  const phases = [
    {
      phase: 'Phase 1',
      title: 'Foundation',
      status: 'Current Focus',
      active: true,
      icon: <Layers className="w-5 h-5 text-cyan-400" />,
      items: [
        'ArcStonks website & brand launch',
        'Community building & social presence',
        'Public Waitlist launch with anti-bot verification',
        'Wallet Checker deployment',
        '4,444 generative collection preparation & smart contracts',
      ],
    },
    {
      phase: 'Phase 2',
      title: 'Collection Launch',
      status: 'Upcoming',
      active: false,
      icon: <Rocket className="w-5 h-5 text-teal-400" />,
      items: [
        '4,444 NFT collection launch on Arc ecosystem',
        'Transparent metadata & artwork reveal',
        'Community growth & partner initiatives',
        'Early holder-focused initiatives and roles',
      ],
    },
    {
      phase: 'Phase 3',
      title: 'Ecosystem Expansion',
      status: 'Planned',
      active: false,
      icon: <Zap className="w-5 h-5 text-cyan-300" />,
      items: [
        'Build out dedicated ArcStonks ecosystem modules',
        'Introduce new community interactive features',
        'Expand holder participation across network events',
        'Develop additional ecosystem utilities',
      ],
    },
    {
      phase: 'Phase 4',
      title: 'Community & Utility',
      status: 'Planned',
      active: false,
      icon: <Milestone className="w-5 h-5 text-sky-400" />,
      items: [
        'New ecosystem and collaborative initiatives',
        'Community engagement & creator experiences',
        'Holder-focused experiences & events',
        'Expanded utility integrations within Arc network',
      ],
    },
    {
      phase: 'Phase 5',
      title: 'Long-Term Vision',
      status: 'Vision',
      active: false,
      icon: <Compass className="w-5 h-5 text-emerald-400" />,
      items: [
        'Continue building around the expanding Arc ecosystem',
        'Expand the global ArcStonks community reach',
        'Introduce future ecosystem developments and integrations',
        'Long-term community-driven growth and governance',
      ],
    },
  ];

  return (
    <section id="roadmap" className="py-20 md:py-28 relative border-t border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 font-mono text-xs uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5" />
            <span>Strategic Timeline</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            ArcStonks <span className="text-cyan-400 glow-cyan">Roadmap</span>
          </h2>

          <p className="text-slate-300 text-base leading-relaxed">
            Our strategic journey as a community-driven initiative built for the Arc ecosystem. This roadmap presents planned vision milestones, structured for organic, long-term development.
          </p>
        </div>

        {/* Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phases.map((p, idx) => (
            <div
              key={idx}
              className={`glass-panel rounded-2xl p-6 relative border transition-all duration-300 flex flex-col justify-between ${
                p.active
                  ? 'border-cyan-400 shadow-cyan-glow bg-[#0a121e]/90'
                  : 'border-cyan-500/15 hover:border-cyan-500/30'
              }`}
            >
              <div>
                {/* Header of Card */}
                <div className="flex items-center justify-between mb-4 border-b border-cyan-500/10 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30">
                      {p.icon}
                    </div>
                    <div>
                      <span className="text-xs font-mono text-cyan-400 block font-bold">
                        {p.phase}
                      </span>
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {p.title}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      p.active
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 animate-pulse'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Milestone Checklist */}
                <ul className="space-y-3 mb-6">
                  {p.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start space-x-2.5 text-xs sm:text-sm text-slate-300">
                      <CheckCircle2
                        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          p.active ? 'text-cyan-400' : 'text-slate-600'
                        }`}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-cyan-500/10 flex items-center justify-between font-mono text-[11px] text-slate-400">
                <span>STAGE {idx + 1} OF 5</span>
                <span className={p.active ? 'text-cyan-300 font-bold' : ''}>
                  {p.active ? '● IN PROGRESS' : '○ QUEUED'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
