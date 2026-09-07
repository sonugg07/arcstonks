'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { KeyRound, Menu, X, ArrowUpRight } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About', href: '#about' },
    { name: 'Roadmap', href: '#roadmap' },
    { name: 'Waitlist', href: '#waitlist' },
    { name: 'Checker', href: '#checker' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#06090e]/90 backdrop-blur-md border-b border-cyan-500/20 py-3 shadow-lg shadow-black/50'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="#home" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:border-cyan-400 group-hover:shadow-cyan-glow transition-all duration-300">
            <KeyRound className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <div className="flex flex-col">
            <span className="pixel-text text-sm sm:text-base font-bold text-white tracking-wider glow-cyan">
              ARC<span className="text-cyan-400">STONKS</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-500/80 tracking-widest uppercase">
              Arc Ecosystem
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-mono text-slate-300 hover:text-cyan-400 transition-colors uppercase tracking-wider relative group py-1"
            >
              {link.name}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-teal-300 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </nav>

        {/* Action Button */}
        <div className="hidden md:flex items-center space-x-4">
          <a
            href="#waitlist"
            className="relative group px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-mono font-bold text-xs uppercase tracking-wider overflow-hidden hover:shadow-cyan-glow transition-all duration-300 transform active:scale-95"
          >
            <span className="relative z-10 flex items-center space-x-1.5">
              <span>Join Waitlist</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center md:hidden space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-400"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#070d17]/95 backdrop-blur-xl border-b border-cyan-500/20 px-6 py-6 space-y-4">
          <nav className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-mono text-slate-200 hover:text-cyan-400 py-2 border-b border-slate-800"
              >
                {link.name}
              </a>
            ))}
          </nav>
          <a
            href="#waitlist"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-center w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-mono font-bold text-xs uppercase tracking-wider"
          >
            Join Waitlist
          </a>
        </div>
      )}
    </header>
  );
}
