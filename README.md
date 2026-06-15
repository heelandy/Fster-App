# 🏠 Foster Care Home Management System

A secure, private, mobile-friendly web application for foster parents to manage placement information, appointments, documents, daily routines, expenses, contacts, medications, and licensing requirements — built privacy-first for real foster-parent daily use.

> **Status:** MVP complete. All acceptance criteria implemented. Build ✅ · Typecheck ✅ · Tests ✅ (26) · Security audit ✅ (see [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md)).

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
| **Admin** | System **overview** (aggregate counts only), user management & audit-log review. Admins cannot view private child data. |

---

## 📚 Documentation

| Doc | What's inside |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System overview, tech stack, request lifecycle, folder map, key design decisions. |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | All 25 models, relationships, enums, indexes. |
| [docs/API.md](./docs/API.md) | Full endpoint reference with auth/capability/feature per route. |
| [docs/ADMIN.md](./docs/ADMIN.md) | Admin console today **and** a gap analysis vs the expanded 25-section admin spec, with a phased roadmap. |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | Roles, plans, and a step-by-step exploration walkthrough (incl. babysitter mode). |
| [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) | Cybersecurity audit, OWASP checklist, and post-review remediation. |

## 🧱 Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **PostgreSQL** + **Prisma** ORM
- **NextAuth** (credentials) + **bcrypt** password hashing
- **Tailwind CSS**
- **Stripe** (Checkout, Customer Portal, Webhooks)
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
Fill in at minimum `DATABASE_URL` and `NEXTAUTH_SECRET` (generate one with `openssl rand -base64 32`). Stripe vars are optional — billing degrades gracefully if unset.

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
  schema.prisma        # 24 models + enums
  seed.ts              # plans + demo accounts
src/
  middleware.ts        # auth gating + nonce CSP + admin guard
  app/
    page.tsx           # landing + pricing
    (auth)/            # login, register
    (dashboard)/       # dashboard layout + all feature pages + /billing + /admin
    api/               # all REST endpoints (auth, resources, stripe, admin, files)
  components/           # UI: CRUD resource, forms, dashboards
  lib/
    auth.ts            # NextAuth config (bcrypt, lockout, audit)
    authz.ts           # RBAC capability matrix + household scoping + sanitisation
    household-resource.ts  # generic IDOR-safe CRUD factory
    plans.ts           # plan catalogue + feature gating (source of truth)
    storage.ts         # private file storage (path-traversal safe)
    stripe.ts / billing-sync.ts
    rate-limit.ts / audit.ts / validation.ts / http.ts / request.ts / env.ts
storage/uploads/        # private files (git-ignored)
SECURITY_AUDIT_REPORT.md
```

---

## 🔐 Security highlights

- Household-scoped **RBAC** with deny-by-default capabilities; **IDOR-safe** queries everywhere.
- **bcrypt(12)** hashing, **account lockout**, login **rate limiting**, anti-enumeration.
- **Private documents** served only through an authenticated, ownership-checked route — never a public URL.
- **Nonce-based CSP**, strict security headers, CSRF origin checks, generic error handling.
- **Signed Stripe webhooks**; entitlements derived only from verified events.
- **Audit logs** for security events and admin actions.

Full details and the OWASP Top 10 checklist are in [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md).

---

## ✅ Acceptance criteria coverage

Foster parents can create a household ✔ · create child profiles ✔ · track appointments ✔ · upload private documents securely ✔ · log medications & daily care ✔ · track expenses & receipts ✔ · manage contacts ✔ · create routines & checklists ✔ · track licensing ✔ · subscribe to paid plans ✔ · Stripe billing works ✔ · free users gated from paid features ✔ · babysitters see only limited care info ✔ · unauthorized users cannot view child data ✔ · admin routes protected ✔ · security audit complete ✔ · app builds & runs locally with no errors ✔.

---

## 📄 License

Private project. All rights reserved.
