# Deployment Architecture — Cloudflare + Railway

This app is **one Next.js (App Router) codebase**. Next.js is full-stack: the same
project serves the UI (frontend) **and** the API routes / server logic (backend).
We keep it unified and deploy the whole app to **Railway**, with **Cloudflare in
front** as CDN / DNS / WAF. The **PostgreSQL database** is a Railway service.

```
            ┌─────────────┐      ┌────────────────────────────┐      ┌──────────────┐
  users ──▶ │  Cloudflare │ ───▶ │  Railway: Next.js app       │ ───▶ │ Railway:     │
            │  CDN/DNS/WAF│      │  (frontend UI + backend API)│      │ PostgreSQL   │
            └─────────────┘      └────────────────────────────┘      └──────────────┘
              caches /_next/static     SSR + /api/* + NextAuth + Prisma     DATABASE_URL
```

> The frontend and backend are **not** separately deployable here — they are one
> Next.js server. "Cloudflare frontend" = Cloudflare proxies/caches in front of the
> single Railway app. If you later build a **separate** mobile/SPA frontend, that
> new app is what would live on Cloudflare Pages and call this app's `/api/*`.

---

## Which folder holds what

| Role | Folders / files | Runs on |
| --- | --- | --- |
| **FRONTEND** (UI) | `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/**/loading.tsx`, `src/app/**/error.tsx`, `src/components/`, `src/app/globals.css`, `tailwind.config.ts`, `postcss.config.js`, `public/` | Rendered by the Next.js server on **Railway**; static assets (`/_next/static/*`, `/public/*`) cached by **Cloudflare** |
| **BACKEND** (API + server logic) | `src/app/api/**/route.ts`, `src/middleware.ts`, `src/lib/**` (auth, authz, prisma, stripe, billing-sync, email, pdf, rate-limit, storage, config…), `src/app/**/route.ts`, `next.config.js` | **Railway** (Node server) |
| **DATABASE** | `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts` | **Railway PostgreSQL** (reached via `DATABASE_URL`) |
| **CONFIG / DEPLOY** | `railway.json`, `.env.example`, `DEPLOYMENT.md`, this file, `.github/` | n/a |

(The split above is **logical**, for clarity and for a future physical split — the
build still produces one deployable Next.js server.)

---

## Railway (backend + database)

1. **Create a PostgreSQL service** in your Railway project → it provides
   `DATABASE_URL`. Reference it from the app service.
2. **Create the app service** from this repo. Railway (Nixpacks) reads
   [`railway.json`](railway.json):
   - Build: `npm run build` (runs `prisma generate && next build`).
   - Start: `npx prisma migrate deploy && npm run start` (applies migrations, then
     serves on `$PORT`).
3. **Set environment variables** (see `.env.example` for the full list). Minimum:
   `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your public Cloudflare URL),
   `ENCRYPTION_KEY`, and the `STRIPE_*` / `RESEND_*` keys you use.
4. Migrations: use `prisma migrate deploy` on Railway (never `db push` in prod).
   Generate migrations locally with `npm run prisma:migrate`.

## Cloudflare (in front of Railway)

1. Add your domain to Cloudflare; point a **CNAME** (proxied / orange cloud) at the
   Railway public domain. Set Railway's custom domain to your hostname.
2. Set `NEXTAUTH_URL` and `APP_URL` to the Cloudflare hostname (HTTPS).
3. Caching: cache `/_next/static/*` and `/public/*` aggressively; **bypass cache**
   for `/api/*`, `/login`, and anything with auth cookies (a cache rule that skips
   cache when the `next-auth.session-token` / `__Secure-…` cookie is present).
4. Keep WAF / rate-limiting on; the app also enforces its own rate limits.

## Deploy phases

| Phase | Frontend | Backend | Database |
| --- | --- | --- | --- |
| **Local dev** | `next dev` serves `src/app` + `src/components` | same process (`src/app/api`, `src/lib`) | local Postgres via `DATABASE_URL` |
| **Staging/Prod** | Railway app (Cloudflare caches static) | Railway app | Railway PostgreSQL |

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the operational runbook (backups, TLS, cron, secrets).
