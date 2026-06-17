# Go-live checklist

What must be done before serving real foster families. Grouped by **must-have** (don't launch without) and **should-have**. Detailed setup for Stripe/email is in [STRIPE_SETUP.md](./STRIPE_SETUP.md) and [EMAIL_SETUP.md](./EMAIL_SETUP.md); hosting/ops detail is in [../DEPLOYMENT.md](../DEPLOYMENT.md).

> Tip: **Admin → System** shows live config-validation warnings. Work until that panel is clean.

## 1. Secrets & environment (MUST)
- [ ] **Rotate the Resend API key** that was committed in `.env.example` (treat it as leaked), and keep real keys only in `.env` / your host's secret store — never in `.env.example`.
- [ ] `NEXTAUTH_SECRET` — strong random (`openssl rand -base64 32`).
- [ ] `ENCRYPTION_KEY` — `openssl rand -hex 32`. **Back it up securely** — losing it makes all encrypted child/medical data unrecoverable. Never change it after data exists.
- [ ] `APP_URL`, `NEXTAUTH_URL`, `ALLOWED_ORIGINS` — set to your real `https://` domain (not localhost).
- [ ] No placeholder values remain (the System tab flags `replace-with-…`, localhost, etc.).

## 2. Database (MUST)
- [ ] Managed PostgreSQL (not a local/dev DB).
- [ ] **Automated daily backups** + a tested restore.
- [ ] Run migrations on the prod DB (`prisma migrate deploy`).

## 3. Stripe — live mode (MUST for paid plans)
- [ ] Switch to **live** keys (`sk_live_…`); set them (Integrations UI or env).
- [ ] **Recreate products + prices in live mode**; update the Price IDs (test IDs don't carry over). If using Payment Links, recreate those live too.
- [ ] **Register the live webhook** (Integrations → *Create live webhook endpoint*) so you get a live `whsec_…`. Confirm events arrive (200s).
- [ ] **Enable the Stripe Customer Portal** (Dashboard → Settings → Billing → Customer portal): turn on **cancel**, **switch plan** (downgrade/upgrade), and **update payment method**. This is what powers the app's **"Manage billing"** button — without it, cancel/downgrade won't work.
- [ ] Do one real end-to-end purchase and confirm the plan updates (via webhook) + appears in **Admin → Finance**.

### How billing management works (cancel / downgrade / remove plan)
- "Manage billing" opens the **Stripe Customer Portal**, where the user can **cancel**, **switch/downgrade** (including to Free by cancelling), update card, and download invoices.
- Cancellations come back via the `customer.subscription.deleted` / `.updated` webhook, which drops the household to **FREE** automatically (`billing-sync.ts`).
- The portal needs the household's Stripe customer to exist — it does after the first purchase (set by checkout or, for Payment Links, by the webhook).

## 4. Email (MUST — auth flows depend on it)
- [ ] Real Resend key + a **verified sending domain** (SPF + DKIM; add DMARC).
- [ ] `EMAIL_FROM` uses that domain (not `onboarding@resend.dev`, which only sends to your own account).
- [ ] **Send test email** (Integrations) to a real inbox → success.
- [ ] Reminders: set `CRON_SECRET` and schedule `POST /api/cron/reminders` (daily) if you want appointment reminders.

## 5. File storage (MUST if serverless / multi-instance)
- [ ] On Vercel/serverless or >1 instance, set `STORAGE_DRIVER=s3` + the `STORAGE_S3_*` vars (local disk is ephemeral there). Single persistent-disk host can keep `local`.

## 6. Accounts & access (MUST)
- [ ] **Remove or disable the seeded demo logins** (`admin@example.com`, `parent@example.com`) — or at minimum change their passwords. (You planned this after the UI check.)
- [ ] Create your real SUPER_ADMIN with 2FA enabled.

## 7. Legal (MUST for a child-data product)
- [ ] Have counsel review `/privacy` and `/terms` (the shipped pages are scaffolds with `[PLACEHOLDERS]`).
- [ ] Confirm data-retention / deletion wording matches your actual practice.

## 8. Should-have (hardening / ops)
- [ ] HTTPS/TLS at the host (HSTS is sent automatically in production).
- [ ] Upstash Redis (`UPSTASH_REDIS_REST_*`) if running >1 instance, so rate limits hold across instances.
- [ ] `ERROR_WEBHOOK_URL` for error alerts (Slack/Sentry relay).
- [ ] From the PART 5 security worklist (`Foster app.txt`): upload AV scanning, optional CAPTCHA on signup/login, Dependabot + clear `npm audit` advisories.
- [ ] A CDN/WAF (e.g. Cloudflare) in front for DoS/DDoS resilience.

## Quick "are we ready?" gate
Build ✅ · typecheck ✅ · tests ✅ · **System tab clean** · one real Stripe purchase upgrades a household · password-reset email arrives · backups running · demo accounts gone · legal reviewed.
