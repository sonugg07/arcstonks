import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Roadmap from '@/components/Roadmap';
import Waitlist from '@/components/Waitlist';
import WalletChecker from '@/components/WalletChecker';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Ambient background glow & cyber grid */}
      <div className="fixed inset-0 cyber-grid opacity-25 pointer-events-none -z-10" />

      {/* Main Navbar */}
      <Navbar />

      {/* Sections */}
      <div className="flex-1">
        <Hero />
        <About />
        <Roadmap />
        <Waitlist />
        <WalletChecker />
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
