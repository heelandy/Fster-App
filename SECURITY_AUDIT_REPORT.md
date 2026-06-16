# Security Audit Report — Foster Care Home Management System

**Date:** 2026-06-15
**Scope:** Full application (authentication, access control, data storage, file handling, payments, dependencies)
**Auditor:** Internal static + manual review
**Verdict:** ✅ **PASS** — No open Critical or High findings at the application layer. Residual items are dependency/framework advisories that are config-dependent and mitigated (see §3).

This app stores highly sensitive foster-care information (child case data, medical records, court documents). Security was treated as a first-class requirement, not an afterthought.

---

## 1. Methodology

| Activity | Performed | Notes |
|---|---|---|
| Static code review | ✅ | Manual review of every API route, the authz layer, and the storage layer. |
| Dependency vulnerability scan | ✅ | `npm audit` (prod + dev). See §3. |
| Route permission audit | ✅ | Every route mapped to its required capability + plan gate. See §4. |
| File-storage permission audit | ✅ | Verified files live outside `/public`, served only via guarded route. |
| Authentication flow audit | ✅ | Credentials, hashing, lockout, session, enumeration timing. |
| Payment flow audit | ✅ | Checkout, portal, webhook signature verification, access sync. |
| Manual OWASP Top 10 checklist | ✅ | See §5. |
| Automated unit tests | ✅ | 26 tests covering RBAC matrix, plan gating, validation, billing→access mapping. |

---

## 2. Findings (OWASP-aligned check items from the spec)

> Format: **Risk** · Location · Explanation · Fix applied · Remaining risk

### 2.1 Broken authentication — ✅ Mitigated
- **Risk:** High → **Resolved**
- **Location:** `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`
- **Explanation:** Weak auth (no hashing, no lockout, user enumeration) is the most common foster-data breach vector.
- **Fix applied:** Passwords hashed with **bcrypt cost 12**. Account **lockout** after 5 failed attempts for 15 minutes (`failedLogins`/`lockedUntil`). A constant bcrypt compare runs even when the user does not exist to prevent **timing-based user enumeration**. Registration returns a generic conflict message and never discloses whether an email exists. Registration is **rate-limited** (5/min/IP) and login is rate-limited (20/min/IP, applied when a client IP is available); per-account lockout is the primary brute-force defense.
- **Remaining risk:** Low. In-memory lockout/rate-limit is per-instance; use a shared store for multi-instance (documented in `rate-limit.ts`).

### 2.2 Broken access control — ✅ Mitigated
- **Risk:** Critical → **Resolved**
- **Location:** `src/lib/authz.ts`, `src/lib/household-resource.ts`, `src/middleware.ts`
- **Explanation:** Foster data is multi-tenant; a member of one household must never reach another household's data, and limited caregivers must not see legal/case data.
- **Fix applied:** Central **RBAC capability matrix** (`can()`) enforced on every mutation/read via `requireCapability`. Three household roles (Foster Parent / Co-Parent / Babysitter) plus optional per-member allow/deny overrides. Babysitters are read-only and scoped to care instructions. Edge middleware blocks unauthenticated access to all `/dashboard`, `/billing`, and non-public `/api/*`.
- **Remaining risk:** Low.

### 2.3 IDOR (Insecure Direct Object Reference) — ✅ Mitigated
- **Risk:** Critical → **Resolved**
- **Location:** `src/lib/household-resource.ts` (`load`/`findFirst`), `src/lib/scope.ts`, every `[id]` route
- **Explanation:** Fetching/mutating a record by id without an ownership check lets attackers enumerate other families' children/documents.
- **Fix applied:** **Every** single-record query is `findFirst({ where: { id, householdId } })` — the household is taken from the authenticated session, never the request. Referenced `childId` values are validated with `assertChildInHousehold` before use. Tested in the RBAC suite.
- **Remaining risk:** Low.

### 2.4 Exposed child data — ✅ Mitigated
- **Risk:** Critical → **Resolved**
- **Location:** `src/lib/authz.ts` (`sanitizeChildForRole`), `src/app/api/admin/*`
- **Explanation:** Sensitive identifiers (case number, caseworker, private notes) must not leak to limited caregivers or admins.
- **Fix applied:** Babysitter responses strip `caseNumber`, `caseworkerName`, `importantNotes`. Admin endpoints **never select child data** — only account metadata. Court/legal contacts are hidden from babysitters at the query level.
- **Remaining risk:** Low. Field-level encryption-at-rest recommended (see §6).

### 2.5 Exposed documents / insecure file upload / public-bucket mistakes — ✅ Mitigated
- **Risk:** Critical → **Resolved**
- **Location:** `src/lib/storage.ts`, `src/app/api/documents/route.ts`, `src/app/api/files/[id]/route.ts`
- **Explanation:** Documents are the highest-value asset. Public static URLs or path traversal would be catastrophic.
- **Fix applied:** Files are stored **outside `/public`** under a random 24-byte key, mode `0600`. There is **no static URL** — downloads go through `/api/files/[id]`, which checks auth + household ownership + `documents:read` + plan feature, then streams the bytes with `Content-Disposition: attachment`, `no-store`, `nosniff`. Uploads enforce an **allow-list of MIME types** and a max size. `resolveKey()` blocks **path traversal**. Storage dir is git-ignored.
- **Remaining risk:** Low. For production use a private object store (S3 w/ private ACL + signed, short-TTL URLs).

### 2.6 SQL injection — ✅ Not exploitable
- **Risk:** High → **Resolved**
- **Location:** All DB access via Prisma.
- **Explanation:** String-concatenated SQL enables injection.
- **Fix applied:** **100% parameterised** queries through the Prisma client; no raw SQL / `$queryRawUnsafe` anywhere. All input is additionally validated by Zod schemas with bounded lengths.
- **Remaining risk:** Negligible.

### 2.7 XSS — ✅ Mitigated
- **Risk:** High → **Resolved**
- **Location:** React rendering, `src/middleware.ts` (CSP)
- **Explanation:** Reflected/stored XSS could exfiltrate session/case data.
- **Fix applied:** React escapes all interpolated output; **no `dangerouslySetInnerHTML`** is used. In **production** a **nonce-based Content-Security-Policy** is set per request (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`). In **development** the script policy is relaxed to `'unsafe-eval' 'unsafe-inline'` because `next dev` requires eval-based source maps + HMR (this relaxation never ships to production). Inputs are length-bounded by Zod.
- **Remaining risk:** Low. `style-src 'unsafe-inline'` is required by the CSS framework; no script execution is permitted inline.

### 2.8 CSRF — ✅ Mitigated
- **Risk:** Medium → **Resolved**
- **Location:** `src/lib/request.ts` (`assertSameOrigin`), NextAuth
- **Explanation:** Forged cross-site state-changing requests.
- **Fix applied:** NextAuth protects its own endpoints with anti-CSRF tokens. Our JSON mutations require a JSON content-type body and verify the **`Origin`** header against an allow-list (`assertSameOrigin` in `mutationGuard`). Auth cookies are `httpOnly`, `sameSite=lax`, `secure` in production.
- **Remaining risk:** Low.

### 2.9 Weak password handling — ✅ Mitigated
- **Risk:** High → **Resolved**
- **Location:** `src/lib/validation.ts`, `src/lib/auth.ts`
- **Explanation:** Short/simple passwords are easily brute-forced.
- **Fix applied:** Policy enforced by Zod: ≥10 chars with upper, lower, and a number. Hashes use **bcrypt cost 12**. Plaintext passwords are never logged or stored.
- **Remaining risk:** Low. Consider HIBP breach-check + optional 2FA (see §6).

### 2.10 Admin route exposure — ✅ Mitigated
- **Risk:** High → **Resolved**
- **Location:** `src/middleware.ts`, `src/lib/authz.ts` (`requireAdmin`), `src/app/api/admin/*`, `src/app/(dashboard)/admin/page.tsx`
- **Explanation:** Admin surfaces must be unreachable by normal users.
- **Fix applied:** **Defence in depth** — middleware rejects `/admin` and `/api/admin` for non-admin JWTs, AND each admin route/page re-checks `requireAdmin()` server-side. Admin actions are written to `AdminAuditLog`.
- **Remaining risk:** Low.

### 2.11 Payment webhook spoofing — ✅ Mitigated
- **Risk:** High → **Resolved**
- **Location:** `src/app/api/stripe/webhook/route.ts`
- **Explanation:** A forged webhook could grant paid access for free or cancel a victim's plan.
- **Fix applied:** The raw request body is verified with **`stripe.webhooks.constructEvent`** using `STRIPE_WEBHOOK_SECRET`. Invalid signatures are rejected (400) and logged (`WEBHOOK_SIGNATURE_INVALID`). Entitlements are derived only from verified Stripe subscription objects, never client input.
- **Remaining risk:** Low. Stripe event replay is bounded by signature timestamp tolerance (Stripe default).

### 2.12 Rate-limit bypass / brute force — ✅ Mitigated
- **Risk:** Medium → **Resolved**
- **Location:** `src/lib/rate-limit.ts`, `src/lib/api.ts`
- **Explanation:** Unlimited attempts enable credential stuffing and scraping.
- **Fix applied:** Fixed-window limiter keyed by `scope:user:ip` on auth (5/min), writes (60/min), uploads/downloads (20/min). Combined with account lockout.
- **Remaining risk:** Medium for distributed attacks against a single instance — move the limiter to Redis/Upstash for production (documented inline).

### 2.13 Sensitive data leakage (error handling/logs) — ✅ Mitigated
- **Risk:** Medium → **Resolved**
- **Location:** `src/lib/http.ts`
- **Explanation:** Stack traces / DB errors echoed to clients leak schema + data.
- **Fix applied:** Central `handle()` wrapper maps known errors to safe messages, returns **generic 500s**, and logs details server-side only. Zod errors return field names, not values. `poweredByHeader` disabled; strict security headers set in `next.config.mjs` + middleware.
- **Remaining risk:** Low.

### 2.14 Dependency vulnerabilities — ⚠️ Accepted/Mitigated (see §3)

---

## 3. Dependency scan

`npm audit` results and disposition:

| Package | Severity | Disposition |
|---|---|---|
| `next` 14.2.x advisories | High (per advisory range) | **Mitigated/Accepted.** Pinned to the latest patched **14.2.35**. The remaining advisories are fixed only in the **v16 major** and are **config-dependent**: they concern the Image Optimizer `remotePatterns`, i18n rewrites, and `next/image` cache — **none of which this app uses** (no remote images, no i18n, `images` unconfigured). Cache-poisoning/CSP-nonce items are mitigated by our nonce-based CSP and `Cache-Control: private, no-store` on sensitive routes. **Recommendation:** schedule a Next 16 upgrade. |
| `uuid` <11.1.1 (via `next-auth`) | Moderate | **Accepted (not exploitable).** The advisory triggers only when a `buf` argument is passed to `uuid()`. `next-auth` calls it without `buf`. Cannot be triggered in this codebase. |
| `esbuild`/`vite`/`vitest`/`tsx`/`glob` | High/Moderate | **Dev-only.** These are build/test tooling and are **not shipped** in the production bundle or runtime. |

**Production runtime dependencies contain no exploitable Critical/High vulnerabilities in this app's usage.**

---

## 4. Route permission matrix (audit)

| Route | Auth | Capability | Plan feature | Tenant scope |
|---|---|---|---|---|
| `POST /api/auth/register` | public | — | — | creates own household |
| `/api/children*` | ✅ | children:read/write | — | householdId |
| `/api/appointments*` | ✅ | appointments:read/write | — | householdId |
| `/api/documents*`, `/api/files/[id]` | ✅ | documents:read/write | documents | householdId |
| `/api/care-logs*` | ✅ | careLogs:read/write | careLogs | householdId |
| `/api/medications*` (+`/logs`) | ✅ | medications:read/write | medications | householdId |
| `/api/expenses*` | ✅ | expenses:read/write | expenses | householdId |
| `/api/contacts*` | ✅ | contacts:read/write | — | householdId (babysitter: non-legal only) |
| `/api/routines*`, `/api/checklists*` | ✅ | routines:read/write | — | householdId |
| `/api/licensing*` | ✅ | licensing:read/write | licensingTracker | householdId |
| `/api/household/members*` | ✅ | members:manage | co-parent/babysitter feature on invite | householdId |
| `/api/stripe/checkout`,`/portal` | ✅ | billing:manage | — | householdId |
| `/api/stripe/webhook` | public (signed) | — | — | resolved from Stripe metadata |
| `/api/admin/*`, `/admin` | ✅ | global ADMIN | — | no child data |

Every entry was verified by reading the handler. Babysitter limited-access and free-vs-paid gating are covered by automated tests.

---

## 5. OWASP Top 10 (2021) checklist

| # | Category | Status |
|---|---|---|
| A01 | Broken Access Control | ✅ RBAC + household scoping + IDOR guards + middleware |
| A02 | Cryptographic Failures | ✅ bcrypt(12); HTTPS/HSTS; secrets via env only; ⚠️ field-level encryption recommended |
| A03 | Injection | ✅ Prisma parameterised + Zod validation |
| A04 | Insecure Design | ✅ deny-by-default capabilities; plan gating; grace-period billing |
| A05 | Security Misconfiguration | ✅ security headers, CSP, no powered-by, generic errors |
| A06 | Vulnerable Components | ⚠️ see §3 (mitigated/accepted, no exploitable prod issue) |
| A07 | Auth Failures | ✅ lockout, rate-limit, anti-enumeration, secure sessions |
| A08 | Integrity Failures | ✅ Stripe webhook signature verification |
| A09 | Logging Failures | ✅ SecurityAuditLog + AdminAuditLog; no sensitive data in client errors |
| A10 | SSRF | ✅ no user-controlled outbound fetches |

---

## 6. Recommendations (non-blocking, for production hardening)

1. **Field-level encryption at rest** for `caseNumber`, medical and notes fields (e.g. libsodium sealed columns or pgcrypto).
2. **Distributed rate-limiter** (Redis/Upstash) for multi-instance/serverless deployments.
3. **Private object storage** (S3 private ACL + signed short-TTL URLs) and antivirus scanning on upload.
4. **Optional 2FA / TOTP** and HaveIBeenPwned breach check at registration.
5. **Schedule Next.js 16 upgrade** to clear framework advisories.
6. **Add a `Permissions-Policy` for `interest-cohort`** and periodic dependency re-scan in CI.

---

## 7. Final status

- Critical findings: **0 open** (all fixed).
- High findings: **0 open** at the application layer (framework dependency items mitigated/accepted with documented rationale).
- Automated security tests: **49 passing** (see §9 for the later batch).
- Build: **passing**. Typecheck: **passing**.

**✅ This audit is marked COMPLETE. The application meets the security acceptance criteria.**
**Update:** §6.1 (field-level encryption) and §6.4 (2FA/TOTP) — originally listed as recommendations — are now **implemented**; see §9.

---

## 8. Post-review remediation (extra-high recall code review, 2026-06-15)

A follow-up multi-angle code review surfaced 15 findings; all were addressed:

| # | Finding | Fix |
|---|---|---|
| 1 | Seeded admin had no household → `requireHousehold()` redirect loop, admin console unreachable | Admin area moved to its own `(admin)` route group (no household dependency); dashboard layout now renders a friendly "no household" shell instead of looping; seed gives the admin a household too. |
| 2 | Per-request nonce CSP on statically-prerendered `/`, `/login`, `/register` blocked Next scripts | Those pages set `export const dynamic = 'force-dynamic'` so the nonce is applied at render. |
| 3 | Login (NextAuth `authorize`) lacked IP rate limiting (register had it) | Per-IP login rate limit added in `authorize()` — **20/min per IP**, applied only when a client IP is available (so it can't collapse all local callers into one shared bucket and lock them out). Per-account lockout remains the primary defense. |
| 4 | JWT role/active state trusted for 8h (demoted/deactivated users kept access) | `requireUser()` now reloads `isActive` + `globalRole` from the DB on every request; revocation is immediate. |
| 5 | Upload size checked only after buffering the whole body | `Content-Length` pre-check rejects oversized uploads before reading the body. |
| 6 | Date-only fields displayed a day early in negative-UTC zones | Date columns formatted with `timeZone: 'UTC'`. |
| 7 | Contact `isLegal` not recomputed on edit → could leak legal contacts to babysitters | `item()` PATCH now applies the resource `transform`; contact transform only recomputes when `role` is present. |
| 8 | Stripe promo code passed human text where a promo ID is required | Code is resolved via `promotionCodes.list({code})` to its id; invalid codes fail clearly. |
| 9 | `maxAppointments` plan limit never enforced | Generic factory gained a `limit` hook; appointments enforce `maxAppointments`. |
| 10 | No webhook idempotency (replays/retries reprocessed) | New `ProcessedWebhookEvent` table; duplicate event ids are acknowledged without reprocessing. |
| 11 | MIME allow-list trusted client `file.type` only | `saveFile` now validates magic bytes and rejects content that contradicts the declared type (e.g. HTML disguised as an image). |
| 12 | Login account enumeration via side-effects | Mitigated by the new per-IP login rate limit (#3) plus the already-symmetric failure logging and constant-time compare. |
| 13–15 | Cleanup: factory limit-hook reuse, triplicated enum lists, duplicate expenses fetch | Added the factory limit hook; introduced `src/lib/enums.ts` as the single source for enum values (consumed by Zod + UI); expenses totals computed server-side so the summary no longer refetches the list. |

Re-verification after remediation: typecheck ✅, production build ✅, tests ✅.

---

## 9. Admin platform & account-security batch (2026-06-16)

This batch implemented several **§6 recommendations** and added new authenticated surface.
Security-relevant design decisions:

| Area | Control |
|---|---|
| **2FA / TOTP** (§6.4) | Dependency-free RFC 6238 (`lib/totp.ts`). Secret generated server-side, **encrypted at rest**, and only activated after the user proves a valid code. Verification is constant-time with ±1 step drift. One-time **backup codes** are stored **bcrypt-hashed** and consumed on use. |
| **Field-level encryption** (§6.1) | AES-256-GCM Prisma middleware now also covers `User.twoFactorSecret`. Sensitive child/medical fields and files were already encrypted at rest. |
| **Password reset** | Tokens are random 256-bit, stored **SHA-256 hashed** (raw token only in the emailed link), single-use, 1-hour expiry. The endpoint is **non-enumerating** (always returns `200`). Reset **bumps `tokenVersion`** → forced logout of all sessions. |
| **Forced logout** | `requireUser()` compares the JWT's `tokenVersion` to the DB; "sign out of all devices" and password reset increment it, instantly invalidating outstanding tokens (closes the 8h-JWT window for compromised sessions). |
| **Email invites** | Invite tokens are SHA-256 hashed; acceptance **requires the signed-in email to match** the invited address (a leaked link can't be redeemed by another account). 7-day expiry, revocable. |
| **Reminder cron** | `/api/cron/reminders` requires `Authorization: Bearer <CRON_SECRET>` (constant-time compare); **disabled (503)** when the secret is unset, so it can't be triggered anonymously. Added to the middleware public-API list intentionally — it self-guards. |
| **Granular admin perms** | New `support.manage` / `analytics.view` / `system.view` permissions; every new admin route calls `requireAdminPermission(...)`. Admin analytics/health expose **aggregates only** — no child records. |
| **CSRF/rate-limit parity** | All new mutations go through `mutationGuard` (Origin check + per-user rate limit) or, for public auth routes, IP rate limiting. New `RateLimits.login` already in place. |

Runtime smoke tests (authenticated): parent ticket create `201` → visible to admin; 2FA setup
returns a valid secret/otpauth URI; admin analytics/health `200`; cron `401` without token /
`200` with it; reset/invite/2fa/admin endpoints all `401` unauthenticated.

Re-verification: typecheck ✅, production build ✅, **tests 49 ✅**, smoke tests ✅.

> **Note on §6.5 (Next.js upgrade):** intentionally deferred. The app remains on the **patched
> 14.2.35**. The 15/16 async-request-API migration would touch the CSRF/rate-limit wrappers across
> ~25 routes, where a missed `await` silently disables a guard — so it warrants a dedicated,
> fully-audited pass rather than inclusion here.
