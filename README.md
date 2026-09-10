# 🏪 Tindahan Ko — Sari-Sari Store Notebook

A simple, mobile-first **digital store notebook** for Filipino sari-sari store owners — with an optional AI assistant ("Suki AI"). Designed like a pen-and-paper utang list, not a complicated POS: big buttons, Taglish labels, and everything works **offline-first**.

> **"Isang digital na notebook para sa tindahan mo."**

## ✨ Features

| Feature | Description |
| --- | --- |
| **Utang Tracker** | Suki list with balances, partial payments, "Mark as Paid", due dates ("Kailan bayad?") with Late/Due-ngayon badges, and one-tap copyable payment reminders (SMS/Messenger) |
| **Daily Benta & Gastos** | Record sales and expenses in seconds; today's totals, weekly chart, and a monthly **Talaan** report with CSV export |
| **Nitong Linggo chart** | Tap any day to see that day's full benta/gastos breakdown — and delete wrong entries with one tap |
| **Mga Paninda (Tinda)** | Simple one-tap stock status: *Marami pa / Sakto lang / Paubos / Ubos* — no fussy inventory counts |
| **Restock List** | Add low-stock items in one tap, estimate quantities & costs, check out when done |
| **Resibo Scanner** | Photograph a supplier receipt → OCR extracts the items → **you review and edit everything** before it's saved (OCR output is never trusted blindly) |
| **Suki AI** 🤖 | Optional assistant that answers "Ano ang dapat kong bilhin sa ₱500?" using **only your local data** — deterministic suggestions with one-tap "Add to Restock List". No hallucinated numbers |
| **Tala sa suki** | Free-form notes per customer (e.g. "bayad tuwing sweldo"), searchable together with transaction notes |
| **Offline-friendly** | All core features work without the internet; only the receipt OCR and Suki AI need a connection |
| **PWA-ready** | Installable identity (manifest, icons), dark mode, responsive from 390px phones to desktop |

## 🧰 Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui** (New York style) + **Lucide icons**
- **Prisma ORM** + **SQLite** (local file database — zero setup)
- **TanStack Query** for data fetching, **framer-motion** for subtle transitions
- **z-ai-web-dev-sdk** (backend only) for optional OCR + Suki AI features

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** and npm (or [Bun](https://bun.sh), which the lockfile targets)
- No database server needed — SQLite is a local file
- The AI/OCR endpoints use `z-ai-web-dev-sdk` and gracefully degrade when unavailable

### Setup

```bash
# 1. Install dependencies
npm install        # or: bun install

# 2. Create your env file
echo 'DATABASE_URL="file:./db/custom.db"' > .env

# 3. Create the database schema
npx prisma db push   # or: bun run db:push

# 4. Run the dev server
npm run dev          # or: bun run dev
```

Open **http://localhost:3000** — on first run the app seeds itself with realistic sample data (customers, products, records) so you can explore immediately.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint check |
| `npm run db:push` | Push `prisma/schema.prisma` to the SQLite database |

### Reseting the demo data

`POST /api/seed` with body `{"force": true}` wipes and re-seeds the sample data.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/            # REST endpoints (customers, utang, sales, expenses,
│   │                   #   products, restock, shopping-list, reports, ai, day, seed)
│   ├── layout.tsx      # PWA metadata + providers
│   └── page.tsx        # Single-screen shell (tab-based UI)
├── components/
│   ├── screens/        # Home / Utang / Tinda / Restock / Suki AI screens
│   ├── shared/         # Sheets, inputs, stat cards, empty states
│   └── ui/             # shadcn/ui components
├── features/           # Feature modules (utang, home, products, restock, ai)
├── hooks/              # TanStack Query hooks + shared store
├── lib/                # Formatting (₱, Manila timezone), API client, utils
├── services/           # Seeding + AI context builders
└── types/              # Shared TypeScript types
prisma/schema.prisma    # 10-table data model (customers, utang, sales, …)
```

## 🔒 Privacy

All store data stays in your local SQLite file. Suki AI only sends **aggregated, non-personal context** (stock statuses, category totals, restock history) to the language model — never customer names, contact details, or amounts owed by specific people.

## 📄 License

Prototype — all rights reserved by the repository owner.
