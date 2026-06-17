# Stripe setup — step by step

This app supports **two ways** to take payments, and you can use either (or both, per plan):

- **Option A — Stripe Checkout Session** (integrated): you store Stripe **Price IDs**; the app builds a checkout session on the fly. Most flexible (promo codes, trials, metadata).
- **Option B — Stripe Payment Link** (no-code): you create a link in the Stripe Dashboard and paste its URL. Simplest to set up. The app still attributes the subscription to the right household via `client_reference_id`.

There are also **two places** to put your keys — pick one (the app resolves **DB first, then env**):

| Where | How | Needs |
|---|---|---|
| **Admin → Integrations** (no code) | Type keys into the UI; stored **encrypted** in the DB | SuperAdmin + **2FA enabled** + a step-up code |
| **`.env` file** (backend) | Set environment variables, restart | file access / redeploy |

---

## Which key is which (and where it's used)

| Key | Example | Used by | Exposed to browser? |
|---|---|---|---|
| **Secret key** | `sk_test_…` / `sk_live_…` | **Backend only** | ❌ never |
| **Webhook signing secret** | `whsec_…` | **Backend only** | ❌ never |
| **Publishable key** | `pk_test_…` / `pk_live_…` | (front-end Stripe.js) | ✅ safe — *but this app uses redirect Checkout, so it's optional* |
| **Price IDs** | `price_…` | Backend (Option A) | n/a |
| **Payment Link URL** | `https://buy.stripe.com/…` | Backend → redirect (Option B) | n/a |

> **In the backend, keys live in `.env`** (these exact names) — or the Integrations UI:
> ```
> STRIPE_SECRET_KEY=sk_test_xxx
> STRIPE_PUBLISHABLE_KEY=pk_test_xxx        # optional (redirect checkout)
> STRIPE_WEBHOOK_SECRET=whsec_xxx
> STRIPE_PRICE_FAMILY_MONTHLY=price_xxx
> STRIPE_PRICE_FAMILY_ANNUAL=price_xxx
> STRIPE_PRICE_PRO_MONTHLY=price_xxx
> STRIPE_PRICE_PRO_ANNUAL=price_xxx
> STRIPE_PRICE_AGENCY_MONTHLY=price_xxx
> STRIPE_PRICE_AGENCY_ANNUAL=price_xxx
> ```
> **Never** commit `.env` or expose the secret/webhook keys.

---

## Step-by-step (TEST / sandbox)

### 1. Get your test keys
Stripe Dashboard → make sure **Test mode** is ON (toggle, top-right) → **Developers → API keys**. Copy the **Secret key** (`sk_test_…`).

### 2. Add the secret key
- **UI:** Admin → **Integrations** → unlock with your authenticator → paste into **Secret key** → Save. (The header should then show **🧪 Test**.)
- **or `.env`:** `STRIPE_SECRET_KEY=sk_test_…` then restart.

### 3. Create products + prices (Option A)
Stripe Dashboard → **Product catalogue → Add product**. Create three: **Family**, **Pro**, **Agency**. For each, add **two recurring prices** — one **Monthly**, one **Annual**. (Free is $0, no Stripe price needed.)

Open each price and copy its **API ID** (`price_…`). Then add the six IDs:
- **UI:** Integrations → **Price IDs** → fill the 6 boxes → Save.
- **or `.env`:** the `STRIPE_PRICE_*` vars above.

> ⚠️ The 500 error you saw (`No such price`) means a Price ID was wrong/empty for the plan you clicked. After this step it returns a clear message instead, but the real fix is correct IDs here.

### 4. Configure the webhook
The webhook is how Stripe tells the app a payment succeeded so it can activate the subscription.

**Local dev (localhost can't be reached by Stripe):** use the Stripe CLI:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` (or Integrations → Webhook signing secret).

**Deployed (public URL):** Admin → Integrations → **“Create live webhook endpoint”**. This calls Stripe, registers `https://YOUR_DOMAIN/api/stripe/webhook`, and stores the signing secret automatically — no copy/paste.

The app listens for exactly these events (the button selects them for you):
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

### 5. Test the flow
Go to **/billing**, pick a plan → you're sent to Stripe Checkout. Use the test card:
```
4242 4242 4242 4242   ·   any future expiry   ·   any CVC   ·   any ZIP
```
On success Stripe returns you to **`/billing?status=success`** (already handled — no `/success` page needed) and the webhook upgrades your plan. Decline testing: `4000 0000 0000 0341` (attaches but fails) / `4000 0000 0000 9995` (insufficient funds).

**Verify:** the household's plan changes on /billing; an entry appears in **Admin → Finance**; the webhook shows `200` in the Stripe CLI / Dashboard.

---

## Option B — Payment Links (no price IDs)
1. Stripe Dashboard (Test mode) → **Payment Links → New** → choose the plan's recurring price → Create.
2. Copy the URL (`https://buy.stripe.com/test_…`).
3. Admin → Integrations → **Payment Links** → paste it into that plan's box → Save.

Now “Subscribe” for that plan redirects to the link instead of building a Checkout Session. The webhook reads the `client_reference_id` the app appends and attributes the subscription to the household. Leave a plan's link blank to keep using its Price ID (Option A). **The webhook from step 4 is still required.**

---

## Going live
1. Stripe Dashboard → turn **Test mode OFF**.
2. Replace keys with the **live** ones: `sk_test_…` → `sk_live_…` (and `pk_test_…` → `pk_live_…` if used).
3. **Recreate products + prices in live mode** (test prices don't carry over) and update the Price IDs.
4. Re-register the webhook against your live keys (Integrations → **Create live webhook endpoint**) so you get a **live** `whsec_…`.
5. If you use Payment Links, recreate them in live mode and update the URLs.

---

## Security rules (enforced)
- Secret key + webhook secret are **backend only**, stored **encrypted** at rest, and **masked** in the UI (never returned in plaintext).
- Editing live keys requires **SuperAdmin + 2FA + a step-up code**.
- Card data **never touches this server** — all entry is on Stripe-hosted pages.
- Webhooks are **signature-verified** and idempotent (replays/spoofs rejected).
