# Tindahan Ko — Mobile (React Native + Expo)

The **standalone Android app** port of the Tindahan Ko web prototype — a digital
store notebook for Filipino sari-sari store owners. Taglish UI, offline-first,
no accounts, no backend, no cloud required.

> The Next.js prototype at the repo root remains the visual & functional spec.
> This `/mobile` app ports it 1:1 to React Native with on-device SQLite.

## ✨ What works (fully offline / airplane mode)

- **Home** — ngayong araw stats (benta/gastos/net + trend), "Mga Dapat Bantayan",
  Nitong Linggo chart with per-day detail + delete, Talaan monthly report (CSV copy), quick actions
- **Utang** — suki list with balances, add utang (new/existing customers), partial/full
  payments, Mark as Paid, due dates with Late/Due ngayon badges, copyable payment
  reminders, "Tala sa suki" notes, note search
- **Tinda** — one-tap 4-status stock (Marami pa / Sakto lang / Paubos / Ubos),
  product drawer with restock history
- **Restock** — "Kailangan ng Bili" suggestions, restock list with qty steppers,
  checkout → restock record + auto stock update, history, receipt scanner with
  **mandatory editable review** before saving
- **Suki AI** — optional; all numbers computed **locally** (context builder +
  deterministic budget allocator). Needs internet + your own GLM API key
  (entered in Settings, stored only on-device). Offline → graceful
  "Offline si Suki ngayon. Available pa rin ang ibang features ng app."

All data persists in on-device **SQLite** (`expo-sqlite`, WAL, versioned
migrations). Closing/reopening the app never deletes data. No demo seed runs in
production — load it optionally from **Suki AI → Settings → Load demo data**.

## 🚀 Quick start (dev)

```bash
cd mobile
bun install          # or: npm install
npx expo start       # scan QR with Expo Go (OCR degrades to manual entry)
```

Optional dev env file (never committed): create `mobile/.env` —

```
EXPO_PUBLIC_GLM_API_KEY=
EXPO_PUBLIC_GLM_BASE_URL=
EXPO_PUBLIC_GLM_MODEL=
```

The **in-app Settings always wins** over env vars. Prefer entering the key on-device.

## 📦 Building the APK

Receipt OCR uses **on-device ML Kit** (`@react-native-ml-kit/text-recognition`),
which needs a development build (Expo Go cannot load it — the app detects this
and falls back to manual item entry, never cloud OCR).

Local dev build (requires Android SDK/NDK):

```bash
npx expo run:android
```

EAS build (cloud, produces `Tindahan-Ko-v1.0.0.apk` via the `preview` profile):

```bash
npm i -g eas-cli
eas login
eas build -p android --profile preview
```

`eas.json` is already configured: `preview` → APK (direct install), `production` → AAB.

## 🧱 Architecture

```
mobile/
├── app/                    # expo-router
│   ├── _layout.tsx         # DbProvider → ThemeProvider → ToastProvider
│   └── (tabs)/             # index (Home) · utang · tinda · restock · suki
└── src/
    ├── db/
    │   ├── client.ts       # openDatabaseSync + PRAGMAs + eager migrations
    │   ├── migrations.ts   # user_version-based, 10 tables
    │   ├── seed.ts         # OPTIONAL demo seed (Settings-triggered only)
    │   └── repos/          # the former API routes, now local functions
    │                       # (same validation + same Taglish error strings)
    ├── logic/              # pure ports: format (Manila days, peso, dueInfo),
    │                       # constants (stock statuses), restock-suggester
    │                       # (deterministic budget allocator), reminder copy
    ├── services/
    │   ├── ai/             # context builder (local SQL aggregates) +
    │   │                   # isolated GLM client (key from on-device settings)
    │   └── ocr/            # on-device ML Kit wrapper + deterministic
    │                       # receipt-text parser → review screen
    ├── store/data.ts       # zustand version bus = refreshAll() consistency
    ├── theme/              # warm amber palette, light+dark, from web tokens
    └── components/         # shared UI primitives + ported screens
```

Money math, Manila-timezone day boundaries (noon-UTC anchor), due-date tones,
stock priorities, and the paubos→ubos→frequent→overdue budget allocator are
ported verbatim from the web prototype.

## 🔐 API key security

No GLM key lives in this repository or the APK. The key is entered by the store
owner in **Suki AI → Settings** and stored only in the app's on-device SQLite.
The core app is fully usable with Suki AI disabled/unconfigured.

## ✅ Manual test checklist (device)

1. Add utang (new + existing suki)
2. Record partial payment + Mark as Paid
3. Add benta / gastos from quick actions
4. Change stock status (one tap on segments)
5. Add item to restock list → mark purchased → checkout
6. Close & reopen app → **all data still there**
7. Airplane mode: everything above still works; Suki AI shows the offline banner
8. Receipt scan (dev build): photo → OCR → **edit review** → save
