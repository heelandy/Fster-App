# Admin System — Current State & Gap Analysis

The project brief was expanded (see `Foster app.txt`, sections 1–25 starting at line 492)
with a full **platform-admin** specification. This document maps that specification to
what is **currently implemented**, what is **partial**, what is **not built yet**, and what
is **not applicable** to a private foster-care app, plus a recommended roadmap.

> **Important context:** the original app was built with a deliberately *minimal* admin
> (per the original brief: *"Admin cannot casually view private child data unless explicitly
> granted"*). The new spec is much larger and generic (it assumes public content, moderation,
> support desks, etc.). Some of it is highly relevant; some does not apply to a private
> foster-care product. Nothing in the new spec has been silently built — this is an honest
> status report so you can decide what to prioritise.

> ### 🆕 Update — admin build batch (shipped)
> Since the original gap analysis, the following were implemented and verified:
> - **Admin roles + granular permissions** ([src/lib/admin.ts](../src/lib/admin.ts)): 7 roles
>   (SUPER_ADMIN/ADMIN/MANAGER/SUPPORT/MODERATOR/FINANCE_ADMIN/READ_ONLY) with a permission
>   matrix; `requireAdminPermission()` enforces it on every admin route. Seeded admin = SUPER_ADMIN.
> - **User management actions**: search/filter, suspend/reactivate, ban/unban, unlock, internal
>   notes, **set admin role**, and delete — all audited with old/new values.
> - **Settings module**: `Setting` table + admin Settings tab; **maintenance mode** (blocks
>   non-admins) and **sign-ups enabled** toggles are wired into the app.
> - **Notifications**: `Notification` table + admin Notifications tab; auto-generated on new
>   sign-up and failed payment.
> - **Dashboard tiles**: revenue, payment issues, unread alerts, access-denied (now emitted).
> - **`ACCESS_DENIED`** security events are now logged on every 403.
>
> Still outstanding (see roadmap below): 2FA / separate admin login, support tickets, rich
> analytics charts, a system-health page, email delivery, and reminder sending.

**Legend:** ✅ implemented · 🟡 partial · ⬜ not built · ➖ not applicable to this product

## Summary

| # | Spec section | Status | One-line summary |
|---|---|---|---|
| 1 | Admin purpose (control center) | 🟡 | `/admin` console exists (overview, users, audit) but with limited actions. |
| 2 | Admin user roles (6 staff tiers) | ⬜ | Only `USER`/`ADMIN` today; no SUPER_ADMIN/MANAGER/SUPPORT/MODERATOR/FINANCE/READ_ONLY. |
| 3 | Admin login system | 🟡 | Lockout, per-IP limit, IP logging, session timeout, activity logging ✅; **no 2FA, no separate admin login, no password-reset/device tracking**. |
| 4 | Admin dashboard | 🟡 | Overview cards + sub breakdowns exist; missing revenue/failed-payments/tickets/system status tiles. |
| 5 | User management module | 🟡 | Read-only user list; **no suspend/ban/edit/reset/verify/notes/delete or search/filter UI**. |
| 6 | Admin management (manage admins) | ⬜ | Cannot create/disable/limit other admins from the UI. |
| 7 | Permission system (granular) | 🟡 | Granular **household** capabilities exist; no granular **platform-admin** permissions. |
| 8 | Content management | ➖ | No public/user-generated content in a foster-care app (could map to plan catalogue/FAQ if wanted). |
| 9 | Reports & moderation | ➖ | No public UGC to moderate. |
| 10 | Payments & subscription module | 🟡 | Per-household Stripe + Customer Portal ✅; **no admin-wide finance dashboard / admin-initiated refunds** (delegated to Stripe Dashboard today). |
| 11 | Support ticket module | ⬜ | Not built (optional). |
| 12 | Settings module | ⬜ | No in-app system settings (maintenance mode, signup toggle, feature flags…). |
| 13 | Analytics & reporting | 🟡 | Basic counts only; no DAU/MAU/retention/churn charts. |
| 14 | Audit log system | ✅ | `AdminAuditLog` + `SecurityAuditLog` (actor, action, target, metadata, IP, time). Missing old/new-value diffs + device info. |
| 15 | Notification system | ⬜ | No admin alerts/notifications. |
| 16 | Security architecture | ✅ (mostly) | HTTPS/HSTS, RBAC, IP logging, rate-limit, CSRF, XSS-CSP, SQLi-safe, audit, no direct DB editing. **Missing: 2FA, field-level encryption, backups.** |
| 17 | Database structure | 🟡 | `users`, `payments`, `subscriptions`, `audit_logs` covered; **missing `admin_users`, `roles`, `permissions`, `role_permissions`, `support_tickets`, `reports`, `notifications`, `settings`**. |
| 18 | Backend architecture (services) | 🟡 | Clean `lib/` layer covers built features; no ticket/report/notification/settings services. |
| 19 | Frontend admin panel (16 pages) | 🟡 | Overview, Users, Audit-log pages exist; most other pages not built. |
| 20 | API structure (admin routes) | 🟡 | `stats`, `users`, `audit` exist; no suspend/ban/refunds/reports/tickets/settings routes. |
| 21 | System health module | 🟡 | `/api/health` only; no DB/API/CPU/memory/storage/backup metrics. |
| 22 | Backup & recovery | ⬜ | Operational concern; recommend managed Postgres backups / `pg_dump` cron. |
| 23 | Admin workflow | 🟡 | Partly supported by existing tools (login → dashboard → users → audit). |
| 24 | Recommended tech stack | ℹ️ | We use Next.js route handlers (not NestJS), NextAuth (not a separate JWT service), local private storage (not S3 yet), no Sentry/Grafana yet. All swappable. |
| 25 | Final architecture summary | 🟡 | ~6/16 capability areas implemented; remainder roadmapped below. |

## What exists today (detail)

The admin console lives in its own route group `src/app/(admin)/` — independent of any
household, gated by `requireAdmin()` and by middleware (`/admin`, `/api/admin/*` require an
`ADMIN` JWT). Tabs:

- **Overview** (`/api/admin/stats`): users (+ admins), households, children, documents,
  upcoming appointments, new users (7d), subscriptions by tier and by status, failed logins
  and access-denied events (24h). **Aggregate counts only — no child records.**
- **Users** (`/api/admin/users`): account metadata (email, name, role, household counts,
  active flag, last login). No password hashes, no child data.
- **Security log** & **Admin log** (`/api/admin/audit`): recent `SecurityAuditLog` and
  `AdminAuditLog` entries.

Security controls already satisfying section 16: bcrypt(12), account lockout, per-IP login
rate-limiting, IP/user-agent logging, 8h session expiry, RBAC, CSRF origin checks, nonce
CSP, Prisma-parameterised queries, audit logging, and a strict "no direct DB editing"
posture (everything goes through guarded routes).

## Not applicable to a private foster-care app

- **Content management (8)** and **Reports & moderation (9)** assume public/user-generated
  content (posts, products, lessons) and user-on-user reporting. A foster-care app has no
  such public surface, so these don't map. The nearest useful equivalents would be managing
  the **plan catalogue** and **FAQ/help pages** — small and optional.

## Recommended roadmap (if you want to grow the admin)

Ordered by value-for-a-foster-care-product and by effort:

**Phase 1 — high value, low effort (extends what's there)**
1. **User actions (5):** suspend/reactivate (toggle `User.isActive` — already enforced by
   `requireUser()`), unlock account, add internal note, view login history. Add search/filter.
2. **Dashboard tiles (4):** revenue + failed-payment counts (from `Payment`/`Invoice`),
   recent-admin-actions panel.
3. **Audit diffs (14):** capture old/new values on admin mutations.

**Phase 2 — staff roles & permissions (the core of the new spec)**
4. **Admin roles + permission system (2, 6, 7):** add an `AdminRole` enum
   (`SUPER_ADMIN`/`ADMIN`/`MANAGER`/`SUPPORT`/`MODERATOR`/`FINANCE_ADMIN`/`READ_ONLY`) and a
   permission grid (`users.view`, `users.suspend`, `payments.refund`, `settings.update`, …),
   reusing the existing capability pattern from `lib/authz.ts`. Add admin-management UI.
5. **Settings module (12):** a `Setting` table + admin page for maintenance mode, signup
   toggle, email-verification requirement, feature flags.

**Phase 3 — security & finance hardening**
6. **2FA (3, 16):** TOTP for admins (and optionally all users), password-reset flow,
   forced logout / session listing.
7. **Finance module (10):** admin-side revenue/refund views (much can stay in the Stripe
   Dashboard; surface read-only summaries here).
8. **Field-level encryption** for `caseNumber`/medical fields; managed **DB backups (22)**.

**Phase 4 — operations (optional for this product)**
9. **Notifications (15)**, **support tickets (11)**, **richer analytics (13)**,
   **system-health metrics (21)**.

Each phase is independently shippable. The existing patterns (RBAC capability matrix,
generic resource factory, audit logging, guarded routes) make Phases 1–2 a natural extension
rather than a rewrite.

> Want me to build any of these? Phase 1 is the quickest concrete win. Just say which phase
> (or which numbered item) and I'll implement it against the current architecture.
