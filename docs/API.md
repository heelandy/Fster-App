# API Reference

All endpoints are Next.js route handlers under `src/app/api`. Unless noted, requests
and responses are JSON. Mutations require a same-origin `Origin` header (CSRF) and are
rate-limited. Every data endpoint is **scoped to the caller's household** — IDs are only
ever resolved together with the session's `householdId`.

## Conventions

- **Auth**: requires a valid session unless "public".
- **Capability**: the RBAC capability checked (`lib/authz.ts`).
- **Feature**: the plan feature required (`lib/plans.ts`); `402` if the plan lacks it.
- Error shape: `{ "error": "message" }` (+ `{ "fields": {...} }` on `422` validation).
- Status codes: `401` unauthenticated · `403` forbidden · `402` plan-gated · `404` not found · `409` conflict · `422` validation · `429` rate-limited.

## Auth & system
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | public | Rate-limited. Body `{name,email,password,householdName}`. Creates user + household + FREE subscription. |
| * | `/api/auth/[...nextauth]` | public | NextAuth (signin/callback/csrf/session/signout). Credentials provider with bcrypt, lockout, per-IP rate limit, optional `totp`/`backupCode` second factor. |
| POST | `/api/auth/forgot-password` | public | Rate-limited. Body `{email}`. Always `200` (no enumeration); emails a single-use, hashed reset token if the account exists. |
| POST | `/api/auth/reset-password` | public | Body `{token,password}`. Validates the token, sets the new password, and bumps `tokenVersion` (forced logout of all sessions). |
| POST | `/api/auth/verify-email` | public | Body `{token}`. Confirms the email address. Rate-limited (in-memory + distributed). |
| POST | `/api/auth/resend-verification` | user | Re-sends the verification email for the signed-in, still-unverified user. |
| GET | `/api/health` | public | Liveness probe. |
| GET | `/api/invites/[token]` | public | Look up a household invite (rate-limited; token is the capability). |
| GET/POST | `/api/cron/reminders` | public + `Bearer CRON_SECRET` | Sends due appointment reminders by email. Idempotent (`reminderSent`). `503` if `CRON_SECRET` unset, `401` on bad token. |

## Account & security — authenticated (self-service)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/account/password` | Change password. Body `{currentPassword,newPassword}` (verifies current). |
| POST | `/api/account/2fa/setup` | Begin TOTP enrollment; returns `{secret, otpauthUri, qrDataUrl}`. `qrDataUrl` is a locally-generated SVG data URL (the secret never leaves the server). Not yet enabled. |
| POST | `/api/account/2fa/enable` | Confirm TOTP `{code}`; activates 2FA and returns one-time `backupCodes`. |
| POST | `/api/account/2fa/disable` | Disable 2FA. Body `{password}` (re-auth required). |
| GET | `/api/account/sessions` | List the user's active device sessions (device label, IP, last-seen; current device flagged). |
| DELETE | `/api/account/sessions/[id]` | Revoke one device session (own sessions only); that device fails auth on its next request. |
| POST | `/api/account/logout-all` | "Sign out of all devices" — bumps `tokenVersion` (invalidates every JWT incl. the current one) and revokes all session rows. |

## Support tickets
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/api/support/tickets` | user | List own tickets / open a new one (`{subject,message,priority}`); notifies admins. |
| GET | `/api/support/tickets/[id]` | user | Own ticket + messages (IDOR-scoped by `userId`). |
| POST | `/api/support/tickets/[id]/messages` | user | Reply (`{body}`); reopens ticket to `OPEN`. |

## Children — capability `children:read` / `children:write`
| Method | Path | Notes |
|---|---|---|
| GET | `/api/children` | List (babysitters get case fields stripped). |
| POST | `/api/children` | Create. Enforces `maxChildren` plan limit. |
| GET/PATCH/DELETE | `/api/children/[id]` | Single record, household-scoped. |

## Appointments — `appointments:read` / `appointments:write`
| GET/POST | `/api/appointments` | List / create (enforces `maxAppointments`). |
| PATCH/DELETE | `/api/appointments/[id]` | |

## Documents — `documents:read` / `documents:write`, **feature `documents`**
| GET | `/api/documents` | Metadata only (never the storage key). |
| POST | `/api/documents` | Multipart upload; size pre-checked, MIME + magic-byte validated. |
| DELETE | `/api/documents/[id]` | Deletes record + file. |
| GET | `/api/files/[id]` | **Authenticated download.** Streams bytes with `Content-Disposition: attachment`, `no-store`, `nosniff` after ownership + capability + feature checks. |

## Daily care logs — `careLogs:read` / `careLogs:write`, **feature `careLogs`**
| GET/POST | `/api/care-logs` | `childId` required on create. |
| PATCH/DELETE | `/api/care-logs/[id]` | |

## Medications — `medications:read` / `medications:write`, **feature `medications`**
| GET/POST | `/api/medications` | `childId` required on create. |
| PATCH/DELETE | `/api/medications/[id]` | |
| GET/POST | `/api/medications/[id]/logs` | Give/miss/refuse log (verifies the medication is in-household). |

## Expenses — `expenses:read` / `expenses:write`, **feature `expenses`**
| GET/POST | `/api/expenses` | `amountCents` integer. |
| PATCH/DELETE | `/api/expenses/[id]` | |
(Monthly/yearly totals are computed server-side on the expenses page; CSV export is client-side.)

## Contacts — `contacts:read` / `contacts:write`
| GET/POST | `/api/contacts` | `isLegal` derived from role; babysitters never receive legal/court contacts. |
| PATCH/DELETE | `/api/contacts/[id]` | PATCH re-derives `isLegal` when role changes. |

## Routines & checklists — `routines:read` / `routines:write`
| GET/POST | `/api/routines` | Create with nested `tasks[]`. |
| DELETE | `/api/routines/[id]` | |
| PATCH | `/api/routine-tasks/[id]` | Toggle a task done (verifies the task's routine is in-household). |
| GET/POST | `/api/checklists` | Create with nested `items[]`. Enforces `maxChecklists`. |
| DELETE | `/api/checklists/[id]` | |
| PATCH | `/api/checklist-items/[id]` | Toggle an item done (+ `doneAt`). |

## Licensing — `licensing:read` / `licensing:write`, **feature `licensingTracker`**
| GET/POST | `/api/licensing` | |
| PATCH/DELETE | `/api/licensing/[id]` | |

## Household — capability `members:manage`
| GET | `/api/household/members` | List members. |
| POST | `/api/household/members` | Add an existing user by email. CO_PARENT requires feature `coParentAccess`; BABYSITTER requires `babysitterMode`. |
| DELETE | `/api/household/members/[id]` | Owner cannot be removed. |
| POST | `/api/household/switch` | Set active household cookie (verifies membership first). |
| GET/POST | `/api/household/invites` | List pending invites / invite by email. Adds existing users directly; emails a tokenised link to new ones (`{invited:true}`). Same feature gates as members. |
| DELETE | `/api/household/invites/[id]` | Revoke a pending invite (household-scoped). |

## Invites — accept flow
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/invites/[token]` | public | Look up an invite (household name, target email, role). `404` if invalid/expired/used. |
| POST | `/api/invites/accept` | user | Accept `{token}`. Requires the signed-in email to match the invite address; creates membership + marks accepted. |

## Billing — capability `billing:manage`
| POST | `/api/stripe/checkout` | Creates a Stripe Checkout session (resolves promo code → promotion-code id). |
| POST | `/api/stripe/portal` | Opens the Stripe Customer Portal. |
| POST | `/api/stripe/webhook` | **Public, signature-verified.** Idempotent (dedup by event id). Syncs subscription status, grace periods, invoices/payments. |

## Admin — global `ADMIN` (via middleware) + granular permission (`lib/admin.ts`)
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/admin/stats` | `users.view` | Aggregate counts only (no child records): users, revenue, payment issues, security 24h. |
| GET/POST | `/api/admin/users` | `users.view` / `users.edit` | List (account metadata + `?q=` search; no hashes/child data) / **create a user** (emails a set-password link; `adminRole` also needs `admins.manage`). |
| PATCH/DELETE | `/api/admin/users/[id]` | per-action | suspend/reactivate/ban/unban/unlock/note/setAdminRole/**verify**/**forceLogout**/**sendPasswordReset**/**editProfile**/**restore** (per-action permission) / **soft-delete** (`users.delete` — deactivates + tombstones, recoverable). Audited old→new; blocks self-suspend/ban/forceLogout/delete. |
| GET | `/api/admin/payments` | `payments.view` | Recent payments (billing metadata only — never card data) for the finance view. |
| POST | `/api/admin/payments/[id]/refund` | `payments.refund` | Refund via Stripe (resolves the invoice's payment_intent/charge); full or partial. Audited. |
| POST | `/api/admin/payments/credit` | `payments.refund` | Apply an account credit to a household's Stripe customer balance. Audited. |
| GET | `/api/admin/reports/export` | `reports.export` | CSV export (`?type=users\|subscriptions\|revenue`). Account/billing metadata only. |
| GET/PATCH | `/api/admin/settings` | `settings.update` | Read / write system flags (maintenance, signup, app name). |
| GET/PATCH | `/api/admin/notifications` | `users.view` | List / mark read (one or all). |
| GET | `/api/admin/tickets` | `support.manage` | List tickets (`?status=` filter). |
| GET/PATCH | `/api/admin/tickets/[id]` | `support.manage` | Ticket + messages / change status (audited). |
| POST | `/api/admin/tickets/[id]/messages` | `support.manage` | Staff reply; moves ticket to `PENDING`. |
| GET | `/api/admin/analytics` | `analytics.view` | DAU/WAU/MAU, 30-day signup & active-user series, churn. |
| GET | `/api/admin/health` | `system.view` | DB latency, storage usage, memory/uptime, integration + queue status, **config warnings**. |
| GET | `/api/admin/audit` | `logs.view` | Recent admin + security audit logs. |
| POST | `/api/admin/step-up` | admin | Re-verify TOTP to unlock sensitive config; sets a 10-min step-up cookie. |
| GET/POST | `/api/admin/integrations` | `admins.manage` + step-up | Read/write Stripe + email config (secrets encrypted, masked in responses). |
| POST | `/api/admin/integrations/stripe/webhook` | `admins.manage` + step-up | Registers the Stripe webhook endpoint via the Stripe API and stores its signing secret. |

> Refunds and account credits are now issued **in-app** via Stripe (the calls above) and
> mirrored in the audit log. See [ADMIN.md](./ADMIN.md) for the full spec-to-implementation
> map (all 25 admin sections).
