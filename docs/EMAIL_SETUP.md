# Email setup (Resend) — step by step

The app sends transactional email for: **password reset**, **email verification**, **household invites**, and **appointment reminders**. Until you configure a provider it runs in **dev-log mode** — those messages are printed to the server log (links still work locally) but are **not delivered**. Before going live you need real email.

Provider: **Resend** (used via its HTTP API — no SDK). Swapping providers means changing only `deliver()` in `src/lib/email.ts`.

## Where the keys go (backend)
Same model as Stripe — **DB first, then env**:

| Where | How | Needs |
|---|---|---|
| **Admin → Integrations → Email** | Type the key in the UI (stored **encrypted**) | SuperAdmin + 2FA + step-up |
| **`.env`** | environment variables, then restart | file access / redeploy |

```
RESEND_API_KEY=re_xxx                                  # secret — backend only
EMAIL_FROM=Foster Care HMS <no-reply@yourdomain.com>   # must be a Resend-verified domain
```

`RESEND_API_KEY` is **backend-only**, never exposed to the browser, and shown **masked** in the UI.

---

## Step-by-step

### 1. Create a Resend account + API key
[resend.com](https://resend.com) → sign up → **API Keys → Create API Key** (give it "Sending" permission). Copy the key (`re_…`).

### 2. Pick your "From" address
- **Quick test:** use `onboarding@resend.dev` as the From — works with no domain setup, but only delivers to **your own Resend account email**.
- **Real use:** Resend → **Domains → Add domain** → add the **DNS records** Resend shows (SPF + DKIM, and ideally DMARC) at your DNS provider → wait for "Verified". Then use `no-reply@yourdomain.com`.

### 3. Add the key + From address
- **UI:** Admin → **Integrations** → unlock with your authenticator → **Email** section → paste the **API key** and **From address** → **Save**. (The Email status tile should switch to **✅ Configured**.)
- **or `.env`:** set `RESEND_API_KEY` and `EMAIL_FROM`, then restart.

### 4. Send a test
Integrations → **Send test email** → it sends to *your* admin email using the saved config.
- ✅ "sent" → check your inbox (and spam). Email is working.
- ⚠️ "only written to the server log" → no key saved yet (save it first).
- ❌ "Resend rejected" → bad key, or the From domain isn't verified.

### 5. (Optional) Appointment reminders
Reminders are sent by a scheduled endpoint, not automatically. To enable:
1. Set `CRON_SECRET` (any long random string) in env.
2. Schedule a daily call (cron job, Vercel Cron, GitHub Action, etc.):
   ```
   POST https://YOUR_DOMAIN/api/cron/reminders
   Authorization: Bearer <CRON_SECRET>
   ```
   Unset `CRON_SECRET` ⇒ the endpoint is disabled (503). It's idempotent (won't re-send).

---

## Going live — checklist
- [ ] Real API key set (not a test key sitting in dev-log mode).
- [ ] Sending **domain verified** in Resend (SPF + DKIM); add **DMARC** for best deliverability.
- [ ] `EMAIL_FROM` uses that verified domain.
- [ ] "Send test email" succeeds to a real inbox.
- [ ] `CRON_SECRET` set + reminder job scheduled (if you want reminders).

## Security
- API key is backend-only, encrypted at rest, masked in the UI.
- Reset/verification/invite tokens are single-use, hashed, and time-limited.
- All interpolated values in emails are HTML-escaped (no injection/phishing via field values).
