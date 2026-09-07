import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'ArcStonks | 4,444 Community NFTs on Arc Ecosystem',
  description: 'The flagship community-focused NFT collection built around the Arc ecosystem. 4,444 unique stonks powering a decentralized community.',
  openGraph: {
    title: 'ArcStonks — 4,444 Community NFTs',
    description: 'The flagship community-focused NFT collection built around the Arc ecosystem.',
    images: ['/images/arcstonks-banner.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen flex flex-col bg-[#06090e] text-slate-100 selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
