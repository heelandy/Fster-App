# 🏠 Foster Care Home Management System

A secure, private, mobile-friendly web application for foster parents to manage placement information, appointments, documents, daily routines, expenses, contacts, medications, and licensing requirements — built privacy-first for real foster-parent daily use.

> **Status:** MVP **+ full admin platform + production hardening** complete. Build ✅ · Typecheck ✅ · Tests ✅ (63) · Security audit ✅ (see [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md)). Going live? See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## ✨ Features

| Module | What it does |
|---|---|
| **Child profiles** | Names/preferred name, DOB, placement status, case number, caseworker, school, doctor, allergies, medications, notes, emergency contacts. Sensitive fields are access-controlled. |
| **Appointments & calendar** | Doctor, therapy, dental, court, school, caseworker, home-inspection and licensing-deadline events with reminders. |
| **Document storage** | Private, access-controlled upload/download of placement, medical, school, court, licensing, receipt and case-note files. |
| **Daily care logs** | Date-based history of meals, sleep, behavior, mood, school, visits, medical concerns, incidents and milestones. |
| **Medication tracker** | Name, dosage, schedule, dates, prescriber, notes + a give/miss/refuse log. |
| **Expense tracker** | Categorised spending, monthly/yearly summaries and CSV export. |
| **Contact manager** | Caseworkers, GAL, attorney, therapist, doctor, teacher, biological family, emergency — with roles & agencies. |
| **Routines & checklists** | Reusable morning/bedtime/visit-day/intake checklists with task completion. |
| **Licensing & compliance** | Training hours, inspections, background checks, renewals with due-date tracking. |
| **Roles** | Foster Parent, Co-Parent (limitable), Babysitter/Respite (limited care view), Admin. |
| **Billing** | Stripe Free/Family/Pro/Agency plans, monthly/annual, promo codes, portal, invoices, grace periods. |
| **Account & security** | Self-service **password change**, **2FA (TOTP)** with a **scannable QR code** (generated locally) + backup codes, a **per-device active-session list** with selective revoke, "sign out of all devices", and a **forgot-password** email flow. |
| **Support** | In-app **support tickets** — users open threads, staff reply and set status. |
| **Household invites** | Invite co-parents/babysitters by **email**; new users get a tokenised join link; pending invites are manageable. |
| **Reminders** | Appointment reminders emailed via a scheduled **cron endpoint** (`/api/cron/reminders`). |
| **Admin platform** | 11-tab console: overview, **user management** (create/edit/suspend/ban/verify/force-logout/send-reset/roles, **soft-delete + restore**), **support tickets**, **analytics** (DAU/MAU/churn charts), **finance** (in-app Stripe **refunds** + **account credits** + **CSV report export**), notifications, **settings**, **integrations**, **system health**, security + admin audit logs. 7 staff roles with granular permissions. Admins cannot view private child data. |
| **SuperAdmin Integrations** | TOTP‑gated page to configure **live Stripe keys/prices** and **register the Stripe webhook** from the UI (no code/env edits), plus email settings. Config resolves DB‑first with env fallback; secrets encrypted at rest. |
| **Email verification** | Optional (admin‑toggleable) confirm‑your‑email flow at signup with resend. |
| **Pluggable infra** | File storage `local` **or S3/R2**; optional **Redis** distributed rate limiting on credential endpoints; optional **error‑reporting** webhook; production **config‑validation** warnings in the System tab. |
| **Legal** | `/privacy` + `/terms` + data‑retention scaffolds (counsel‑review templates). |

---

## 📚 Documentation

| Doc | What's inside |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System overview, tech stack, request lifecycle, folder map, key design decisions. |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | All models, relationships, enums, indexes. |
| [docs/API.md](./docs/API.md) | Full endpoint reference with auth/capability/feature per route. |
| [docs/ADMIN.md](./docs/ADMIN.md) | Admin console + the full spec-to-implementation map for all 25 admin sections. |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | Roles, plans, and a step-by-step exploration walkthrough (incl. babysitter mode). |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Go‑live runbook: hosting model, secrets, DB backups, TLS, Stripe/email, storage, cron, monitoring, legal. |
| [docs/STRIPE_SETUP.md](./docs/STRIPE_SETUP.md) | Step‑by‑step Stripe setup: where keys go (env vs Integrations UI), prices, webhook, test cards, Payment Links, go‑live. |
| [docs/EMAIL_SETUP.md](./docs/EMAIL_SETUP.md) | Step‑by‑step email (Resend) setup: API key, verified domain, the "Send test email" check, reminders cron, go‑live. |
| [docs/GO_LIVE.md](./docs/GO_LIVE.md) | Go‑live checklist: secrets, DB backups, live Stripe + Customer Portal, email, storage, demo‑account removal, legal. |
| [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) | Cybersecurity audit, OWASP checklist, and post-review remediation. |

## 🧱 Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **PostgreSQL** + **Prisma** ORM (with transparent **AES‑256‑GCM field encryption** middleware)
- **NextAuth** (credentials) + **bcrypt** password hashing + **TOTP 2FA** (dependency-free, RFC 6238)
- **Tailwind CSS** (admin analytics charts are dependency-free inline SVG)
- **Stripe** (Checkout, Customer Portal, Webhooks)
- **Resend** HTTP API for transactional email (pluggable; dev-log fallback)
- **Zod** validation
- Edge **middleware** (auth gating, nonce-based CSP), in-memory **rate limiting**, **audit logging**, private **file storage**
- **Vitest** for tests

---

## 🚀 Getting started

### Prerequisites
- Node.js ≥ 18.17
- A PostgreSQL database (local or hosted)
- (Optional) A Stripe account with TEST keys for billing

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in at minimum `DATABASE_URL`, `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` (generate each with `openssl rand -base64 32` / `openssl rand -hex 32`). Optional, with safe fallbacks:
- **Stripe** (`STRIPE_*`) — billing degrades gracefully if unset.
- **Email** (`RESEND_API_KEY`, `EMAIL_FROM`) — unset ⇒ dev-log mode: reset/invite/reminder emails are printed to the server log (links still work locally) instead of being sent.
- **Reminders** (`CRON_SECRET`) — set it, then schedule `GET/POST /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>`. Unset ⇒ the endpoint is disabled (503).

### 3. Create the database schema
```bash
npx prisma migrate dev --name init   # or: npx prisma db push
```

### 4. Seed plans + demo accounts
```bash
npm run db:seed
```
This seeds the plan catalogue and two logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin12345` |
| Foster parent (Pro, demo data) | `parent@example.com` | `Parent12345` |

> ⚠️ Change/remove these before any real deployment.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000.

### Useful scripts
```bash
npm run build       # prisma generate + next build
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run prisma:studio
```

---

## 💳 Stripe setup (optional)

1. Create 4 products with monthly + annual prices (Family, Pro, Agency; Free is $0).
2. Put the price IDs in `.env` (`STRIPE_PRICE_*`).
3. Run the webhook listener in dev:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the printed signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Subscriptions, cancellations, failed-payment grace periods and access restoration all sync via the verified webhook (`src/lib/billing-sync.ts`).

**Card data never touches this server** — all entry happens on Stripe-hosted pages.

---

## 🗂 Project structure

```
prisma/
  schema.prisma        # 32 models + enums
  seed.ts              # plans + demo accounts
src/
  middleware.ts        # auth gating + nonce CSP + admin guard
  app/
    page.tsx           # landing + pricing
    (auth)/            # login, register, forgot/reset-password, invite-accept
    (account)/         # /account — password, 2FA, sessions (no household required)
    (dashboard)/       # dashboard layout + feature pages + /billing + /support
    (admin)/           # /admin console (own route group, 9 tabs)
    api/               # REST endpoints: auth, account, resources, support,
                       #   invites, cron, stripe, admin, files
  components/           # UI: CRUD resource, forms, dashboards, admin tabs
  lib/
    auth.ts            # NextAuth config (bcrypt, lockout, 2FA, audit)
    authz.ts           # RBAC capability matrix + household scoping + tokenVersion
    admin.ts           # granular admin-permission matrix
    totp.ts / tokens.ts / email.ts   # 2FA, hashed tokens, pluggable email
    household-resource.ts  # generic IDOR-safe CRUD factory
    plans.ts           # plan catalogue + feature gating (source of truth)
    crypto.ts          # AES-256-GCM field/file encryption
    storage.ts         # private file storage (path-traversal safe)
    stripe.ts / billing-sync.ts / notify.ts / settings.ts
    rate-limit.ts / audit.ts / validation.ts / http.ts / request.ts / env.ts
storage/uploads/        # private files (git-ignored)
SECURITY_AUDIT_REPORT.md
```

---

## 🔐 Security highlights

- Household-scoped **RBAC** with deny-by-default capabilities; **IDOR-safe** queries everywhere.
- **bcrypt(12)** hashing, **account lockout**, login **rate limiting**, anti-enumeration.
- **Two-factor authentication (TOTP)** with one-time backup codes; **forced logout** of all sessions via a per-user `tokenVersion` (bumped on password reset / "sign out everywhere").
- **AES-256-GCM encryption at rest** for sensitive child/medical fields, the 2FA secret, and uploaded files (transparent Prisma middleware). Reset/invite tokens are stored **hashed**, never raw.
- **Private documents** served only through an authenticated, ownership-checked route — never a public URL.
- **Nonce-based CSP**, strict security headers, CSRF origin checks, generic error handling.
- **Signed Stripe webhooks**; entitlements derived only from verified events. Card data never touches the server.
- **Audit logs** for security events and admin actions (with old→new diffs on admin mutations).

Full details and the OWASP Top 10 checklist are in [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md).

---

## ✅ Acceptance criteria coverage

Foster parents can create a household ✔ · create child profiles ✔ · track appointments ✔ · upload private documents securely ✔ · log medications & daily care ✔ · track expenses & receipts ✔ · manage contacts ✔ · create routines & checklists ✔ · track licensing ✔ · subscribe to paid plans ✔ · Stripe billing works ✔ · free users gated from paid features ✔ · babysitters see only limited care info ✔ · unauthorized users cannot view child data ✔ · admin routes protected ✔ · security audit complete ✔ · app builds & runs locally with no errors ✔.

---

## 🧭 Planned / deferred

These are intentionally **not** in the current build and are tracked as separately-verified follow-ups:

- **Next.js 14 → 16 major upgrade.** Deferred on purpose. The app runs on the **patched, secure 14.2.35**; there's no outstanding advisory forcing the jump. Next 15/16 make `cookies()`/`headers()`/`params`/`searchParams` **async**, which would ripple through the security wrappers (`assertSameOrigin` CSRF, `mutationGuard` rate-limit) across ~25 routes — a wide change whose only build-uncatchable failure mode is a silently-skipped guard. It deserves its own focused, fully-audited pass rather than being bundled in.
- **Operational hardening for production:** managed Postgres **backups** (or `pg_dump` cron), **S3/private object storage** instead of the local dir, and a **Redis-backed** rate limiter (the in-memory limiter is single-instance).

---

## 📄 License

Private project. All rights reserved.
