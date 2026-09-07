# ArcStonks — 4,444 Community NFT Project (Arc Ecosystem)

ArcStonks is a modern, full-stack Web3 application built for the **Arc ecosystem**. It features a 4,444 generative NFT collection identity, server-side anti-bot CAPTCHA verification, independent waitlist storage, a public wallet eligibility checker, and a private, password-protected administrative dashboard with CSV import/export capabilities.

---

## Key Features

1. **Persistent Database (`arcstonks.db`)**:
   - Built on SQLite in Write-Ahead Logging (WAL) mode for concurrency and zero-loss persistence.
   - Separate tables for public submissions (`waitlist_users`) and admin-approved whitelists (`eligible_wallets`).
   - Settings table (`site_settings`) holding global state switches that persist across browser restarts, page refreshes, and server reboots.

2. **Server-Side Anti-Bot & CAPTCHA Verification**:
   - Integration with **Cloudflare Turnstile** (`https://challenges.cloudflare.com/turnstile/v0/siteverify`).
   - Cryptographic server-signed challenge fallback ensures bots without server authorization cannot bypass submission, even in test/offline modes.
   - EVM address normalization and duplicate detection.

3. **Public Wallet Checker**:
   - Allows users to check whitelist eligibility and NFT allocations without connecting a wallet.
   - Controlled by the admin **Checker Switch [ON / OFF]**.
   - Queries individual records securely without ever leaking the full whitelist to client browsers.

4. **Private Administrative Dashboard (`/admin`)**:
   - Protected by server-side authentication using secure HTTP-only JWT cookies.
   - Live toggles for **Waitlist [ON / OFF]** and **Checker [ON / OFF]**.
   - **Waitlist Management**: Real-time address view, search, deletion, and **Export CSV** (`wallet_address.csv`).
   - **Eligible Wallet Management**: Manual addition, inline allocation editing, deletion, and **CSV Bulk Upload** with real-time validation reporting (success, duplicate, and invalid breakdowns).
   - One-click **Promote to Whitelist** to convert waitlist users into whitelist allocations.

5. **Waitlist Community Tasks & Genuine Verification**:
   - Multi-step community task system (Follow, Like, Repost, Comment on X).
   - X (Twitter) username identity binding & anti-sybil validation (1 X account = 1 wallet).
   - Action-gated anti-rush countdown timer.
   - Admin audit and CSV export including X handles alongside wallet addresses.

6. **Cyberpunk Web3 Aesthetic**:
   - Deep obsidian background (`#06090e`) with neon cyan (`#00f0ff`) and Arc teal (`#00ffcc`) accents.
   - Glowing retro-pixel typography matching the official ArcStonks visual brand.
   - Real-time animated candlestick chart index simulation.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS, Custom Glassmorphism, Google Fonts (`Press Start 2P`, `Space Grotesk`, `JetBrains Mono`)
- **Database**: SQLite (WAL mode via `better-sqlite3`)
- **Security**: JWT (`jsonwebtoken`), Cookie session, HMAC challenge validation
- **Icons & Effects**: `lucide-react`, `canvas-confetti`

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build and Run Production
```bash
npm run build
npm start
```

---

## Admin Portal Access

- URL: [http://localhost:3000/admin](http://localhost:3000/admin)
- Password: `arcstonks@9888` (changeable in `.env.local` via `ADMIN_PASSWORD`)

---

## Automated Verification

To run the automated verification test suites:
```bash
# Core End-to-End Suite
node scripts/test-e2e.js

# Community Tasks & Anti-Sybil Suite
node scripts/test-tasks-e2e.js
```
