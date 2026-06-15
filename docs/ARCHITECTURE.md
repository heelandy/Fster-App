# Architecture

This document explains how the Foster Care Home Management System is built and why.

## 1. Overview

A single Next.js 14 (App Router) application that serves both the UI (React Server
Components + small client components) and the JSON API (route handlers). Data lives
in PostgreSQL, accessed through Prisma. Authentication is NextAuth (credentials),
billing is Stripe, and all sensitive operations are guarded by a household-scoped
role-based access-control (RBAC) layer.

```
Browser ──HTTPS──► Next.js (Edge middleware → RSC pages / Route handlers)
                         │                          │
                         │                          ├── lib/authz  (RBAC + household scoping)
                         │                          ├── lib/validation (Zod)
                         │                          ├── Prisma ──► PostgreSQL
                         │                          ├── lib/storage ──► private file dir
                         │                          └── Stripe API (billing)
                         └── Edge middleware: auth gate + nonce CSP + admin gate
```

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | RSC for reads, route handlers for the API |
| Language | TypeScript (strict) | `tsc --noEmit` is part of CI/verify |
| DB | PostgreSQL | |
| ORM | Prisma 5 | parameterised queries; migrations in `prisma/migrations` |
| Auth | NextAuth 4 (Credentials) + bcrypt(12) | JWT sessions, 8h |
| Styling | Tailwind CSS | |
| Validation | Zod | every mutation body is parsed |
| Payments | Stripe (Checkout, Portal, Webhooks) | no raw card data on our server |
| Tests | Vitest | pure-logic unit tests |

## 3. Request lifecycle

1. **Edge middleware** (`src/middleware.ts`) runs first on every non-static request:
   - generates a per-request nonce and sets a strict **Content-Security-Policy**;
   - gates `/dashboard`, `/billing`, `/admin` and non-public `/api/*` behind a valid
     session JWT (`getToken`); unauthenticated API calls get `401`, pages redirect to `/login`;
   - restricts `/admin` and `/api/admin/*` to `ADMIN` JWTs (fast pre-filter).
2. **Route handler / page** runs on the Node runtime with Prisma access:
   - `requireUser()` re-validates the account against the DB (active + role) — authoritative;
   - `requireHousehold()` resolves the caller's active household + membership + plan tier;
   - `requireCapability()` / `requireFeature()` enforce RBAC and plan gating;
   - Zod validates input; Prisma performs the query **scoped by `householdId`**.

Defence in depth: middleware is a fast gate, but the per-request DB checks in the
route/page are the source of truth (so a revoked admin/deactivated user loses access
immediately, not at token expiry).

## 4. Folder structure

```
prisma/
  schema.prisma            # 25 models + enums
  migrations/              # SQL migrations
  seed.ts                  # plan catalogue + demo accounts
src/
  middleware.ts            # auth gate + nonce CSP + admin gate (Edge)
  app/
    page.tsx               # landing + pricing (force-dynamic for CSP)
    (auth)/                # login, register
    (dashboard)/           # household app: layout + feature pages + /billing
    (admin)/               # admin console: own layout (no household dependency)
    api/                   # all REST endpoints
  components/              # CRUD resource, forms, dashboards, clients
  lib/
    auth.ts                # NextAuth config (bcrypt, lockout, login rate-limit, audit)
    authz.ts               # RBAC capability matrix + household scoping + sanitisation
    household-resource.ts  # generic IDOR-safe CRUD factory (limit/transform/listWhere hooks)
    resources.ts           # per-resource factory configs
    plans.ts               # plan catalogue + feature/limit gating (source of truth)
    enums.ts               # single source of enum values (Zod + UI share)
    validation.ts          # Zod schemas
    storage.ts             # private file storage (path-traversal + magic-byte safe)
    stripe.ts, billing-sync.ts
    rate-limit.ts, audit.ts, http.ts, request.ts, api.ts, env.ts, scope.ts
storage/uploads/           # private files (git-ignored)
docs/                      # this documentation
SECURITY_AUDIT_REPORT.md
```

## 5. Key design decisions

### 5.1 Two distinct role systems
- **Household roles** (`HouseholdMember.role`): `FOSTER_PARENT`, `CO_PARENT`, `BABYSITTER` —
  control who can do what *within a household's data*.
- **Global role** (`User.globalRole`): `USER` or `ADMIN` — controls access to the
  platform **admin console**. (The newly-added spec proposes a richer set of staff
  roles — see [ADMIN.md](./ADMIN.md) for the gap analysis.)

### 5.2 Household-scoped multi-tenancy (IDOR prevention)
Every record belongs to a `Household`. Single-record reads/writes always use
`findFirst({ where: { id, householdId } })`, where `householdId` comes from the
authenticated session — never the request body. Referenced `childId`s are validated
with `assertChildInHousehold`. This is the central guarantee that one family can never
see or touch another family's data.

### 5.3 Generic CRUD factory
`lib/household-resource.ts` provides `collection()` and `item()` handlers configured by
`lib/resources.ts`. Each generated handler enforces auth → capability → plan feature →
rate-limit → household scoping → Zod validation, then runs the Prisma op. Optional hooks:
`limit` (plan row caps), `transform` (derive fields, e.g. `contact.isLegal` from role),
`listWhere` (e.g. hide legal contacts from babysitters), `stamp` (inject `authorId`).
Resources with bespoke needs (children sanitisation, nested routine/checklist items)
stay hand-written for clarity.

### 5.4 Plan gating is code, not data
`lib/plans.ts` is the authoritative source for which tier unlocks which feature and the
numeric limits. The DB `Plan` table mirrors it (seeded) for display, but access decisions
always resolve against the code map so they can't be tampered with via data.

### 5.5 Private file storage
Documents are written **outside** `/public` under a random key with mode `0600`, and are
only served through `/api/files/[id]` after an auth + ownership + capability + feature
check. Uploads are size-bounded (before buffering) and validated by MIME allow-list **and**
magic-byte sniffing. See [SECURITY_AUDIT_REPORT.md](../SECURITY_AUDIT_REPORT.md).

### 5.6 Stripe is the billing source of truth
Entitlements are derived only from **signature-verified** webhook events, deduplicated by
event id (`ProcessedWebhookEvent`). Failed payments enter a grace window before access is
removed; a later successful payment restores it. Card data never touches our server.

## 6. Environments & verification

- `npm run typecheck` — strict TS.
- `npm run build` — `prisma generate` + `next build`.
- `npm test` — Vitest unit tests (RBAC matrix, plan gating, validation, billing→access, contact flag).
- See [README](../README.md) for local setup, and [USER_GUIDE](./USER_GUIDE.md) to explore.
