# Mobile Platform Plan

How to take the app from "installable PWA" (shipped) to a polished presence on each
OS. Two tracks per platform:

- **PWA track** — the installable web app. One codebase, instant updates, no store
  review, no developer accounts. Recommended baseline for every platform.
- **Store track** — a thin native wrapper around the same web app, submitted to an
  app store. Adds discoverability + deeper OS features, at the cost of accounts,
  native builds, and review cycles. Optional, per platform.

Status markers: ✅ done · 🟡 in progress · ⬜ not started · ➖ optional/deferred

---

## 0. Already shipped (foundation — benefits every platform)

- ✅ Web App Manifest (`src/app/manifest.ts`) — standalone, coral theme, start_url `/dashboard`
- ✅ Real PNG icons 192/512 + iOS apple-icon 180 (`scripts/gen-icons.cjs`) + SVG favicon
- ✅ Service worker registered prod-only (`public/sw.js`, currently no-op passthrough)
- ✅ Native-style mobile bottom-tab nav + "More" sheet; safe-area aware
- ✅ Viewport `themeColor` + `viewportFit: cover`; `appleWebApp` metadata

---

## 1. Cross-platform PWA hardening (do first — shared by all)

These lift the PWA from "installable" to "feels like a real app" everywhere.

| # | Task | Notes |
|---|------|-------|
| 1.1 ⬜ | **Custom install prompt** (Android + desktop) | Capture `beforeinstallprompt`, stash it, show an in-app "Install Foster" button. iOS doesn't fire this — see 2.x. |
| 1.2 ⬜ | **Offline fallback** | Upgrade `sw.js` from no-op to: cache the app shell + a branded `/offline` page; **network-first for everything, never cache authed API/HTML** (the app is private — caching user data is a data-leak risk). Keep it conservative. |
| 1.3 ⬜ | **Manifest `screenshots` + `shortcuts`** | `screenshots` → richer install UI on Android/desktop. `shortcuts` → long-press app-icon quick actions (e.g. Today, Add child). |
| 1.4 ⬜ | **Web Push notifications** | The big shared backend feature. VAPID keypair (env-only secret), a `PushSubscription` model + `/api/push/subscribe`, a `push`/`notificationclick` handler in `sw.js`, and a server sender. Works on Android, desktop, **and iOS 16.4+ (installed PWA only)**. One build serves all platforms. |
| 1.5 ⬜ | **Lighthouse PWA audit** | Run in Chrome DevTools; fix any "installable"/best-practice gaps. Acceptance gate for the whole effort. |
| 1.6 ➖ | **`.well-known` routing** | Add a Next route/static handler so `/.well-known/assetlinks.json` (Android) and `/.well-known/apple-app-site-association` (iOS) can be served from the domain root — only needed once we pursue Store tracks. Served via Cloudflare → Railway. |

---

## 2. iOS / iPadOS

### PWA track (Add to Home Screen)
- 2.1 ✅ apple-touch-icon (`src/app/apple-icon.png`)
- 2.2 ⬜ **iOS install coaching UI** — iOS has no install button. Detect iOS Safari + not-standalone and show a one-time hint: "Tap Share → Add to Home Screen." (Lucide icons, no emoji.)
- 2.3 ⬜ **Splash screens** — iOS wants `apple-touch-startup-image` `<link>`s per device resolution (portrait set covers the common iPhones/iPads). Generate with a script like our icon generator. Without them the launch shows a blank coral screen (acceptable, but splash is nicer).
- 2.4 ⬜ **iOS quirks pass** — verify safe-area insets on notch/Dynamic-Island devices, 100vh/keyboard behavior, no rubber-band on the fixed tab bar, status-bar style.
- Constraints to accept: ~50 MB cache cap; Web Push only on 16.4+ and only once installed; no background sync.

### Store track (App Store) — optional, heaviest
- 2.5 ➖ **Prerequisites:** Apple Developer Program **$99/yr**; a **Mac with Xcode** (or a cloud Mac CI: EAS Build / Codemagic).
- 2.6 ➖ **Wrap with Capacitor** (recommended) or PWABuilder iOS package — a native shell loading the web app + native plugins.
- 2.7 ➖ **Pass Guideline 4.2 ("minimum functionality")** — Apple rejects thin web wrappers. Add real native value: native push (APNs), camera/document capture, biometric unlock. Plan for ≥1 review rejection.
- 2.8 ➖ `apple-app-site-association` for universal links (uses 1.6).

---

## 3. Android

### PWA track (install via Chrome)
- 3.1 ✅ Installable (manifest + icons + SW). Maskable icons already correct.
- 3.2 ⬜ Wire 1.1 (custom install button) — Android fully supports `beforeinstallprompt`.
- 3.3 ⬜ Confirm adaptive-icon masking looks right across launcher shapes (our full-bleed heart already handles this).
- Web Push: works natively once 1.4 lands.

### Store track (Google Play) — optional, lightest store path
- 3.4 ➖ **Prerequisites:** Google Play Console **$25 one-time**. No Mac needed.
- 3.5 ➖ **TWA (Trusted Web Activity)** via **Bubblewrap** or **PWABuilder** — wraps the PWA; runs full-screen with no browser bar.
- 3.6 ➖ **Digital Asset Links** — serve `/.well-known/assetlinks.json` (uses 1.6) with the app's signing-cert fingerprint to verify domain ownership (removes the URL bar).
- 3.7 ➖ Generate signed AAB, store listing, content rating, privacy policy link (already have `/privacy`).

---

## 4. Desktop (Windows / macOS / Linux)

### PWA track (install via Chrome/Edge)
- 4.1 ✅ Installable today.
- 4.2 ⬜ Wire 1.1 install button (works in Chromium desktop).
- 4.3 ➖ `shortcuts` (1.3) → jump-list / dock menu entries.
- 4.4 ➖ Window Controls Overlay for a more app-like title bar (progressive enhancement).

### Store track — optional
- 4.5 ➖ **Microsoft Store (Windows):** package as **MSIX via PWABuilder**, submit to Partner Center (one-time fee). Lightest desktop store path.
- 4.6 ➖ Mac App Store: same Capacitor/Mac/$99 path as iOS — low ROI; skip unless requested.

---

## 5. Recommended sequencing

1. **Phase A — PWA hardening (1.1–1.5):** install prompts + offline + **Web Push**. One
   codebase, every platform benefits, no accounts/review. Highest value-per-effort.
2. **Phase B — iOS PWA polish (2.2–2.4):** the platform that most needs hand-holding.
3. **Phase C — Android Play Store (TWA):** cheapest, fastest store presence ($25, no Mac).
4. **Phase D — iOS App Store (Capacitor):** only if store presence on iOS is required;
   needs $99/yr + a Mac + native features to pass review.
5. **Phase E — Store desktop (MSIX):** optional, low effort via PWABuilder.

## 6. Decision needed from you

- **Do we need app-store listings at all, or is "installable PWA" enough?**
  - PWA-only → we do Phases A + B and stop (no accounts, no fees, instant updates).
  - Store presence → add C/D/E and budget the accounts: Play **$25 once**, Apple
    **$99/yr + a Mac**, Microsoft one-time.
- **Push notifications priority?** It's the largest shared item (backend + SW + keys) and
  unlocks engagement on all three platforms — worth doing early in Phase A if wanted.

(No emoji in app code/pages — Lucide icons only — applies to every UI item above.)
