# App Blueprint — Reusable Architecture & Patterns

A domain-agnostic blueprint extracted from this project. It captures the **stack,
patterns, and conventions** so a brand-new app (any domain) can be built with the
same logic. Replace the example domain nouns (e.g. "household", "agency", "child")
with your own entities; the structure stays the same.

---

## 1. Philosophy

- **One unified full-stack codebase** (Next.js App Router): UI, API routes, and the
  ORM live together. Don't split frontend/backend unless you truly need a separate
  client (e.g. a native app calling a shared API).
- **Deny-by-default access control**, enforced on every route; the database query is
  always scoped to the caller's tenant (no trust in client-supplied ids).
- **Secrets are environment-only** — never settable through the admin UI.
- **A generic CRUD factory** so each new resource is ~10 lines, not a hand-written
  controller. New features should reuse shared infra, not re-implement it.
- **Always ship green**: typecheck + unit tests + production build pass before "done".

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router, route handlers, server components) + TypeScript |
| DB / ORM | PostgreSQL + Prisma |
| Auth | NextAuth (credentials provider) + JWT session, role re-read from DB each request |
| Validation | Zod (one schema per resource; reused by API + forms) |
| Payments | Stripe (Checkout + Customer Portal + webhooks **and** a pull-reconcile fallback) |
| Styling | Tailwind CSS with a custom `brand` palette + component classes in `globals.css` |
| Tests | Vitest (unit tests for lib/ logic) |
| PDF | Zero-dependency hand-rolled text-PDF generator |
| Hosting | Monolith on a Node host (Railway) + CDN/DNS/WAF in front (Cloudflare); managed Postgres |

---

## 3. Project structure (folder → role)

```
src/
  app/
    (group)/layout.tsx, page.tsx     ← FRONTEND: route groups per area, server components
    api/**/route.ts                  ← BACKEND: route handlers (GET/POST/PATCH/DELETE)
    globals.css                      ← theme component classes (.card/.btn/.input/.badge)
    middleware.ts                    ← auth pre-filter + security headers + cache-control
  components/                        ← FRONTEND: client + shared UI, generic <CrudResource>
  lib/                               ← BACKEND core: auth, authz, prisma, validation,
                                       a resource factory, http helpers, audit, rate-limit,
                                       billing, pdf, config, email, storage
prisma/
  schema.prisma, migrations/, seed.ts ← DATABASE
```

Route groups (parenthesized dirs) map URL areas to layouts/roles, e.g. a dashboard
area, an admin console, an auth area, a public/legal area, and (optionally) a
separate tenant-portal area at its own top-level path.

---

## 4. Data layer (Prisma) conventions

- Every tenant-owned model carries the tenant FK (e.g. `tenantId`/`householdId`) with
  `@@index`, and `onDelete: Cascade` from the tenant.
- Optional cross-links use `onDelete: SetNull`; declare **both** sides of a relation.
- Lifecycle/state uses **enums** (status fields), with a separate "response/decision"
  enum when a human must accept/decline something.
- Stamp creator/author columns (`createdById`/`authorId`) when you'll later report
  per-user activity.
- Append-only **audit log** tables (admin actions + security events): actor, action,
  target, old→new value, IP, timestamp. No edit/delete path exists for them.
- Iterate locally with `prisma db push`; deploy with `prisma migrate deploy`.

---

## 5. Auth & RBAC (three layers)

1. **Identity** — `requireUser()` resolves the session and **re-reads role + active +
   tokenVersion from the DB every request** (a demoted/banned/forced-logout user loses
   access immediately, not at token expiry). Per-device session rows allow selective revoke.
2. **Tenant capabilities** — a `Capability` string union + a per-role capability map
   (e.g. OWNER / MEMBER / LIMITED). `requireCapability(ctx, cap)` throws 403. Optional
   granular allow/deny overrides layered on the role.
3. **Multi-tenant org layer** (when an org oversees many tenants) — a parallel
   `requireOrgMember()` + `requireOrgCapability()` + `requireOrgResource(ctx, id)` that
   verifies the resource belongs to the caller's org before any mutation. Roles:
   ADMIN (all) / WORKER (operational) / VIEWER (read-only).

**GOLDEN RULE:** privileged/admin users can see aggregate data but never another
tenant's private records, passwords, or audit history.

---

## 6. The CRUD factory (the big time-saver)

A generic factory turns a config into REST handlers:

- `collection(config)` → `{ GET, POST }`; `item(config)` → `{ PATCH, DELETE }`.
- `ResourceConfig` fields: `delegate` (the Prisma model), `scope` (rate-limit key),
  `readCap`/`writeCap`, optional plan `feature` gate, Zod `schema`, `childField`
  (`'required'|'optional'` for sub-entity links), `include`, `orderBy`, optional
  row-count `limit` (plan limit), `stamp(ctx)` (inject author/creator), `listWhere(ctx)`
  (extra filters, e.g. hide sensitive rows from limited roles), `transform(data, ctx)`
  (derive computed fields on create/edit).
- The factory **always** scopes queries by `tenantId` (IDOR-safe), enforces the
  capability + feature gate, validates input with Zod, and validates that any
  referenced sub-entity id belongs to the same tenant.

**Adding a resource = ** Prisma model + Zod schema + a `ResourceConfig` + two ~3-line
route files (`collection`/`item`) + a page using a generic `<CrudResource>` with
field/column defs + a nav entry. No bespoke controller.

---

## 7. API route conventions

- Wrap handlers in `handle(async () => …)` which turns thrown `HttpError`/`ZodError`
  into safe responses and **never leaks internal messages/stack traces**.
- `Errors.{unauthorized,forbidden,notFound,badRequest,rateLimited,payment,conflict}()`.
- `json(data, status)` for responses; raw `new Response(buf, {headers})` for files/PDF
  (mark those routes `runtime='nodejs'` + `dynamic='force-dynamic'`).
- Mutations: `mutationGuard(scope, userId, RateLimits.write)` (CSRF/origin + rate limit)
  then an audit write (`logSecurity`/`logAdmin`).
- Scope every query by the resolved tenant id; for `[id]` routes, re-verify ownership
  before mutating.

---

## 8. Validation (Zod)

- One schema per resource in a central `validation.ts`; reuse small helpers
  (`shortText`, `optionalShort`, `longText`, `isoDate`, `optionalDate`).
- **Coercion footgun:** `z.coerce.boolean('false') === true`. For string `'true'/'false'`
  from selects use `z.union([z.boolean(), z.enum(['true','false']).transform(v=>v==='true')])`.
- `schema.partial()` powers PATCH; `transform` re-derives computed flags on edit too.

---

## 9. Billing (Stripe), if monetized

- Checkout Sessions (preferred) + Customer Portal; entitlements derive **only** from
  signed, idempotent webhooks **plus** a pull-reconcile fallback (resolves missed/delayed
  webhooks by customer id or owner email). Card data never touches your server.
- Plan catalogue + feature gating live **in code** (source of truth, tamper-proof);
  only Stripe Price IDs are configured via UI/env. Effective tier re-resolved per request.
- Admin tools: in-app refunds/credits, manual comp/grant, CSV export — all audited.

---

## 10. PDF generation (zero-dependency)

A small `pdf.ts` builds simple, paginated, word-wrapped text PDFs (Helvetica) with
dynamically-computed xref offsets and ASCII sanitization — no heavy library. Expose
`buildTextPdf(lines)` plus domain helpers; serve from auth-gated `force-dynamic` GET routes.

---

## 11. UI & theming

- Define a `brand` color scale + neutral surface scale in `tailwind.config.ts`.
- Component classes in `globals.css`: `.card`, `.btn`/`.btn-primary`/`.btn-secondary`,
  `.input`, `.label`, `.badge`. Re-theming = change the palette + these classes; the
  whole app follows because everything uses `brand-*` tokens.
- Generic `<CrudResource>` renders list + create/edit form from field/column defs
  (`text|textarea|date|datetime|number|money|select|childSelect`), so resource pages
  are declarative.

---

## 12. Security posture

- Secrets in env only; masked, never returned to clients.
- Parameterized queries (Prisma), React auto-escaping + nonce CSP, CSRF origin check
  (no fail-open), rate limiting (in-memory, optional Redis), bcrypt(12), optional 2FA/TOTP,
  optional upload AV-scan + CAPTCHA (gated), private file storage with authed download.
- Generic error responses; audit metadata carries no private PII.
- CSV exports: neutralize formula injection (prefix `=+-@`-leading cells with `'`).

---

## 13. Deployment topology

Keep the monolith. Deploy the whole app to a Node host (Railway) with a managed
Postgres service; put a CDN/DNS/WAF (Cloudflare) in front. Build = `prisma generate &&
next build`; start = `prisma migrate deploy && next start`. CDN caches static assets,
bypasses cache for `/api/*` and authenticated (cookie-bearing) requests. Document a
folder→role mapping (frontend / backend / database) even though it deploys as one unit.

---

## 14. Dev & verify workflow

- Central `.env.example`; resolve config DB-first with env fallback where you want
  runtime overrides.
- Definition of done for any batch: `tsc --noEmit` clean · unit tests pass · production
  build passes; then a concise summary of what shipped and what's deferred.
- Keep a living spec/status file (PART-structured, with ✅/🟡/⬜/➖ markers) updated as
  features land. Run a code review on the diff and save findings to `CODE_REVIEW.md`.
- (Windows/OneDrive only) prepend Node to PATH, set `DATABASE_URL`, and kill node +
  delete the `.next` dir before building to avoid file-lock/EINVAL errors.

---

## 15. Bootstrapping a new app from this blueprint

1. Scaffold Next.js + TS + Tailwind; add Prisma + Postgres; add NextAuth (credentials).
2. Copy the `lib/` core: `http`, `authz` (capabilities + `requireUser`/`requireCapability`),
   `validation` helpers, the resource factory (`household-resource` equivalent),
   `rate-limit`, `audit`, `config`, `pdf`, and (if needed) `stripe`/`billing-sync`.
3. Define your tenant model + role/capability map for YOUR domain.
4. For each entity: Prisma model → Zod schema → `ResourceConfig` → two route files →
   `<CrudResource>` page → nav entry.
5. Add an admin console route group gated by an admin permission matrix + audit logs.
6. (Optional) add the org/multi-tenant oversight layer mirroring §5.3.
7. Set the `brand` palette + `globals.css` classes to your brand.
8. Wire deployment per §13; keep the verify workflow per §14.
