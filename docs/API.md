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
| * | `/api/auth/[...nextauth]` | public | NextAuth (signin/callback/csrf/session/signout). Credentials provider with bcrypt, lockout, per-IP rate limit. |
| GET | `/api/health` | public | Liveness probe. |

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

## Billing — capability `billing:manage`
| POST | `/api/stripe/checkout` | Creates a Stripe Checkout session (resolves promo code → promotion-code id). |
| POST | `/api/stripe/portal` | Opens the Stripe Customer Portal. |
| POST | `/api/stripe/webhook` | **Public, signature-verified.** Idempotent (dedup by event id). Syncs subscription status, grace periods, invoices/payments. |

## Admin — global `ADMIN` (via middleware + `requireAdmin`)
| GET | `/api/admin/stats` | Aggregate counts only (no child records). |
| GET | `/api/admin/users` | Account metadata (no password hashes, no child data). |
| GET | `/api/admin/audit` | Recent admin + security audit logs. |

> See [ADMIN.md](./ADMIN.md) for how this maps to the expanded admin specification and
> which additional admin routes (suspend/ban, refunds, settings, tickets, etc.) are not
> yet implemented.
