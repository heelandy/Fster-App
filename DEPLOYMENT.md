# Deployment & Go‑Live Checklist

This is the operator runbook for taking Foster Care HMS to production. The app
code is ready; the items below are **infrastructure, secrets, and policy** that
only you can complete. Work top‑to‑bottom. After deploying, open the admin
**System** tab — it surfaces live configuration warnings.

> ⚠️ This app stores sensitive information about children in care. Treat secrets,
> backups, and the legal review as hard requirements, not optional polish.

---

## 0. Choose a hosting model (decides two things below)

| Model | File storage | Rate limiting |
|---|---|---|
| **Single long‑running container/VM** with a persistent disk (Render, Railway, Fly, a DigitalOcean droplet) — *simplest path* | `STORAGE_DRIVER=local` works (back the disk up) | in‑memory limiter is fine |
| **Serverless / multi‑instance** (Vercel, etc.) | **must** use `STORAGE_DRIVER=s3` (local disk is ephemeral) | set `UPSTASH_REDIS_*` for cross‑instance limits |

---

## 1. Secrets & core config (blocker)

Generate and set as environment variables (never commit `.env`):

- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `ENCRYPTION_KEY` — `openssl rand -hex 32`. **Back this up in a secrets manager.** Losing it makes all encrypted child/medical data permanently unrecoverable. Never rotate it without a re‑encryption migration.
- `APP_URL`, `NEXTAUTH_URL`, `ALLOWED_ORIGINS` → your real `https://` domain.
- `DATABASE_URL` → managed Postgres (below).

The System tab flags placeholder secrets and localhost URLs in production.

## 2. Database + backups (blocker)

- Provision **managed PostgreSQL** (Neon, Supabase, RDS, etc.).
- Run migrations on deploy: `npx prisma migrate deploy` (not `db push`).
- Enable **automated backups** / point‑in‑time recovery, or schedule `pg_dump`. Test a restore at least once.
- Create your real admin out‑of‑band, then **remove the demo seed accounts** (`admin@example.com`, `parent@example.com`) before opening signups.

## 3. TLS (blocker)

Terminate HTTPS at your host/proxy. HSTS and security headers are already emitted by the app (`next.config.mjs`), so serving over plain HTTP will break behavior.

## 4. Email (Resend)

You can set these in **env** *or* from the admin **Integrations** page (no redeploy):
`RESEND_API_KEY`, `EMAIL_FROM` (a verified domain with SPF/DKIM). Without it, the app runs in dev‑log mode and password resets / invites / reminders **do not actually send**.

## 5. Stripe live mode

Easiest via the admin **Integrations** page (SuperAdmin, 2FA‑gated):
1. Enable 2FA on your admin account (`/account`).
2. Integrations → enter your **live secret + publishable keys** and **price IDs**.
3. Click **Create live webhook endpoint** — it registers `/api/stripe/webhook` with Stripe and stores the signing secret automatically.

(Or set `STRIPE_*` env vars the classic way — env is the fallback.) Create your live products/prices in Stripe first.

## 6. File storage (serverless only)

Set `STORAGE_DRIVER=s3` and the `STORAGE_S3_*` vars (AWS S3 or Cloudflare R2, path‑style). Files are encrypted by the app before upload and served only through the authenticated route. **Test an upload + download + delete with real credentials** — the SigV4 client is dependency‑free and unit‑tested for signing, but verify against your bucket.

## 7. Reminder cron

Set `CRON_SECRET` (`openssl rand -hex 32`), then schedule a call to `GET https://yourdomain/api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>` (Vercel Cron, a system cron, GitHub Actions, cron‑job.org…). Suggested cadence: every 15 minutes.

## 8. Distributed rate limiting (serverless/multi‑instance)

Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. This adds cross‑instance limits on login, registration, password reset, email verification, and invite lookup. (Single instance: the built‑in in‑memory limiter is sufficient.)

## 9. Monitoring & logs

- Set `ERROR_WEBHOOK_URL` to receive unhandled‑error reports (Slack/Discord/Sentry‑relay/custom).
- Add an uptime monitor on `/api/health`.
- Ensure your host retains application logs; the in‑app **Security** and **Admin** audit logs cover security/admin actions.

## 10. CI / dependencies

- Run `npm audit` (and `npm run typecheck`, `npm test`, `npm run build`) in CI.
- Track the **Next.js 14 → 16** upgrade as a separate, fully‑audited change (deliberately deferred; the app runs on the patched 14.2.35).

## 11. Legal / compliance (blocker for this domain)

- Complete and have **counsel review** `/privacy` and `/terms` (drafts in `src/app/(legal)/`), including the **data‑retention** section.
- Confirm obligations for child‑welfare PII: state foster‑care confidentiality statutes, applicable data‑protection law (GDPR/CCPA as relevant), and any agency requirements.
- Fill in retention periods (`[N] days/months`) and your processor list.

---

## Post‑deploy smoke test

1. `/api/health` returns 200.
2. Register a new account → receive + click the **verification** email.
3. Forgot‑password → receive + use the reset link.
4. Admin → **System** tab shows green DB, no critical config warnings.
5. Admin → **Integrations**: 2FA unlock works; create the live webhook; a real Stripe test purchase flows through `/api/stripe/webhook`.
6. Turn **Require email verification** on (admin → Settings) only after email delivery is confirmed working.
