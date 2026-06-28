# Performance Backlog

Tracked performance work for the system. Status: ✅ done · 🟡 in progress · ⬜ not started.
Grounded in the actual codebase (see the file references). Tier 1 shipped 2026-06-24.

---

## Tier 1 — shipped ✅ (2026-06-24)

- ✅ **Composite indexes for hot filter paths** (`prisma/schema.prisma`):
  `Medication(householdId, isActive)`, `LicensingRequirement(householdId, status)`,
  `Placement(status)`, `Placement(parentResponse)`. (Already existed and verified good:
  `Appointment(householdId, startsAt)`, `Visit(householdId, visitDate)`,
  `Announcement(agencyId, createdAt)`, `Goal(householdId, status)`.)
- ✅ **NPI lookup off the request path.** The admin verification queue was firing one external
  NPPES HTTP call (6s timeout) **per agency on every list load**. Now it's an on-demand
  per-agency "Check NPI registry" button → `GET /api/admin/agencies/[id]/npi`.
- ✅ **Landing-page plan catalogue cached.** `resolvePlanCatalogue()` is wrapped in
  `unstable_cache` (5-min revalidate, `tags: ['plans']`); an admin plan edit calls
  `revalidateTag('plans')` to bust it instantly. No DB hit per anonymous landing-page visit.

---

## Tier 2 — not started ⬜ (medium impact)

- ⬜ **Collapse serial DB round-trips on the dashboard.**
  `src/app/(dashboard)/dashboard/page.tsx` runs ~4 sequential query phases and re-fetches the
  household the layout already loaded. Fold the independent queries into one `Promise.all` and
  dedup the household lookup via `requestCache`. Each Railway↔Postgres round-trip is pure latency.
- ⬜ **Pin Prisma connection pooling.** Set explicit `connection_limit` / `pool_timeout` on
  `DATABASE_URL`; add **PgBouncer** before scaling to multiple Railway instances (otherwise
  concurrent requests exhaust Postgres's connection cap).
- ⬜ **Cloudflare edge caching + Brotli.** Cache `/_next/static/*` and the icons at the edge so
  repeat/mobile visitors load from Cloudflare, not Railway. (`next.config.mjs` sets security
  headers but no `Cache-Control` — do it at Cloudflare.)
- ⬜ **Activate the service worker app-shell cache.** Turn the no-op `public/sw.js` into a
  static-asset/app-shell cache — **never** authed API/HTML (data-leak risk). Also Phase A in
  `MOBILE_PLATFORM_PLAN.md`.

---

## Tier 3 — not started ⬜ (as you scale / polish)

- ⬜ **Code-split large client bundles.** `src/components/agency-portal.tsx` (~900 lines) and
  `src/components/admin-client.tsx` ship as one big client chunk each — lazy-load the tab panels
  with `next/dynamic` to shrink initial JS.
- ⬜ **Modernize the encryption layer.** `src/lib/prisma.ts` uses the deprecated `$use`
  middleware; migrate to Prisma Client Extensions (`$extends`). Add a searchable hash column if
  encrypted fields (e.g. child names) ever need SQL-side search/sort.
- ⬜ **Observability.** Add sampled slow-query logging / a light APM so future tuning is
  data-driven, not guesswork.

---

Pick up Tier 2 first — the dashboard round-trip consolidation is the quickest, safest win.
