# User Guide

A walkthrough for exploring the running app at **http://localhost:3000**.

## Demo accounts (from the seed)

| Role | Email | Password | Notes |
|---|---|---|---|
| Foster parent | `parent@example.com` | `Parent12345` | **Pro** plan, has sample data. Best starting point. |
| Admin | `admin@example.com` | `Admin12345` | Has its own household **and** the Admin console. |

> Change or remove these before any real deployment.

## Roles at a glance

**Household roles** (who can do what inside a household):
- **Foster Parent** — full control: children, all tracking, documents, members, billing.
- **Co-Parent / Household Member** — manage day-to-day data; **cannot** manage billing,
  members, or household settings. Individual capabilities can be revoked.
- **Babysitter / Respite** — **read-only**, limited to care info: children (with case
  number / caseworker / private notes **hidden**), care logs, medications, routines, and
  **non-legal** contacts only. No documents, no legal/court info, no expenses, no licensing.

**Global role**: `ADMIN` unlocks the platform Admin console (separate from households).

## Subscription plans

| Plan | Children | Documents | Care logs / Meds / Expenses | Licensing | Co-parent / Babysitter | Multi-home |
|---|---|---|---|---|---|---|
| **Free** | 1 | — | — | — | — | — |
| **Family** | up to 5 | ✅ basic | ✅ | — | — | — |
| **Pro** | unlimited | ✅ full | ✅ | ✅ | ✅ | — |
| **Agency** | unlimited | ✅ | ✅ | ✅ | ✅ | ✅ + agency dashboard |

Feature gating is enforced everywhere: the nav hides locked features, pages show an
upgrade screen, and the API returns `402` if bypassed. Free-plan limits (1 child, 10
appointments, 2 checklists) are enforced on create.

## Suggested exploration path (as the foster parent)

1. **Log in** as `parent@example.com`. You'll land on the dashboard overview (children
   count, upcoming appointments, active medications).
2. **Children** → open the seeded child "Al", or add a new child profile.
3. **Appointments** → add a doctor/court/school appointment; attach it to a child.
4. **Documents** → upload a PDF/image. Click the filename to download it — note the URL is
   `/api/files/<id>` (authenticated), never a public link. Try logging out and hitting that
   URL: you'll be blocked.
5. **Care Logs** → add a day's entry (meals, sleep, mood, incidents…). Date-based history.
6. **Medications** → add a medication; it has dosage/schedule/prescriber fields.
7. **Expenses** → add expenses; see the month/year totals update and try **Export CSV**.
8. **Contacts** → add a caseworker (legal) and a doctor (care). Remember the caseworker
   will be hidden from a babysitter.
9. **Routines / Checklists** → create one (e.g. "Bedtime") with several items and tick them off.
10. **Licensing** → add a requirement (e.g. "CPR/First Aid") with a due date.
11. **Household** → add members (see below).
12. **Billing** → view plans; checkout needs Stripe test keys to complete.

## Try the babysitter limited-access mode

1. Open a **private/incognito window**, go to `/register`, and create a second account
   (e.g. `sitter@example.com`).
2. Back in the **parent** account → **Household** → add `sitter@example.com` as a
   **Babysitter** (the Pro plan allows this).
3. Log in as the sitter in the incognito window. You'll see only care-relevant sections;
   the child's case number/caseworker/notes are stripped, documents and legal contacts are
   hidden, and everything is read-only.

## Explore the Admin console

Log in as `admin@example.com` and click **Admin**:
- **Overview** — platform-wide counts (users, households, children, documents,
  subscriptions by tier/status, 24h security events). Aggregate numbers only.
- **Users** — all accounts (no private child data).
- **Security log / Admin log** — recent audited events.

See [ADMIN.md](./ADMIN.md) for what the admin can and cannot do, and the roadmap for the
expanded admin spec.

## Notes & limits while exploring

- **Billing**: checkout/portal need Stripe **test** keys in `.env` (`STRIPE_*`). Everything
  else works without Stripe.
- **Reminders**: appointment/medication reminder *times* are stored, but no background
  job/email is sent in this MVP (delivery is a deployment concern).
- **Reset the data**: re-run `npm run db:seed` (idempotent for plans/admin; demo parent is
  created once). To wipe entirely: drop & recreate the `foster_care` database, then
  `npx prisma migrate deploy` and `npm run db:seed`.
