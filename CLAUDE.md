# Project guide (Claude / contributors)

Foster Care Home Management System — Next.js 14 (App Router) + Prisma + Postgres,
deployed as a monolith on Railway behind Cloudflare.

## Database workflow — IMPORTANT (this prevents the recurring P3009 error)

- The **source of truth** for the DB schema is `prisma/schema.prisma`, applied with
  **`prisma db push`** — in **dev AND prod**. Railway's `startCommand` (in `railway.json`)
  runs `npx prisma db push` on deploy.
- **Do NOT run `prisma migrate dev` / `prisma migrate deploy`.** The `prisma/migrations/`
  folder is frozen at migration #7 and has drifted behind the schema (recent fields/indexes
  went in via `db push` only). Running `migrate` causes **P3009** ("migration failed / column
  already exists"). The npm `prisma:migrate` and `prisma:deploy` scripts are deliberately
  redirected to `db push` so the muscle-memory commands stay safe.
- **To apply a schema change:** edit `schema.prisma` → `npx prisma db push` → `npx prisma
  generate`. On the Windows/OneDrive box, kill node + clear `.next` first (see build routine).
- `db push` is additive-safe; it only refuses on a *destructive* change (dropped column/table),
  at which point use `--accept-data-loss` deliberately.
- If migrations are ever revived: clear the failed `_prisma_migrations` row first, then
  regenerate a baseline that matches the live schema. (Migration #7's SQL is already idempotent.)

## Non-negotiable invariants

- **No emoji** in app code or pages — use `lucide-react` icons. (Emoji only to mark completed tasks.)
- **Secrets are environment-only** (`src/lib/env.ts`) — never settable through the admin UI.
- **Plan feature-gating + limits live in CODE** (`src/lib/plans.ts`), the entitlement boundary;
  only commercial fields (name/description/price/active) are DB-editable.
- **GOLDEN RULE:** privileged/admin users never see another tenant's private records, passwords,
  or audit history.
- The **service worker must never cache authed responses** (the app is private).

## Build / verify (Windows + OneDrive)

- `npm run build` = `prisma generate && next build`. Before any build or `db push`: kill node
  (`taskkill //F //IM node.exe //T`) and clear `.next`, or OneDrive throws EINVAL/lock errors.
- Green gates: `npx tsc --noEmit` · `npx vitest run` · `next build`.

## Where things live

- `PERFORMANCE.md` — performance backlog (Tier 1 shipped; Tier 2/3 tracked).
- `MOBILE_PLATFORM_PLAN.md` — PWA / per-OS mobile roadmap.
- `APP_BLUEPRINT.md`, `GAP_ANALYSIS.md`, `Foster app.txt` — product spec / status.
