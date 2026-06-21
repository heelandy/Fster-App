# Code Review — PART 7 caregiver + agency batch

Scope: the uncommitted working-tree changes implementing the caregiver suite
(behaviour, closet→visit log, communication, journal, today, timeline, emergency,
resources, PDFs) and the agency workflow (case goals, scheduled visits, override,
secure messaging, reporting/analytics, training surfacing), plus admin Plans tab
and the coral re-skin.

Method: multi-angle review (max-effort recall). Independent finder passes for
(1) line-by-line correctness + language pitfalls, (2) access-control / tenant
isolation (IDOR), (3) React/Next.js UI, and (4) schema / cross-file / conventions.

## Headline

**No critical or high-severity bugs found.** The correctness pass and the
auth/IDOR pass each returned zero findings:

- **Auth/IDOR (clean):** every new agency `[id]` route re-checks
  `household.agencyId === ctx.agencyId` (or via `requireAgencyHome`) before
  mutating; the foster-parent CRUD routes go through the household-scoped factory
  (`collection()`/`item()` scope all queries by `householdId`); `placements:override`
  is held only by `AGENCY_ADMIN`; `AGENCY_VIEWER` has no write capability on any
  mutating route. No cross-tenant read/write path found.
- **Correctness (clean):** PDF xref byte-offsets are computed dynamically as the
  document serializes (word-wrap can't desync them); the report `groupBy`/`_count`
  usage and the `Promise.all` destructuring order in the agency home-detail route
  line up; all new enum literals match the Prisma schema; the `z.coerce.boolean`
  footgun was already avoided in `inventorySchema.needed`.

## Findings & resolutions

| # | Sev | File | Issue | Status |
|---|-----|------|-------|--------|
| 1 | Medium | `src/app/(dashboard)/dashboard/today/page.tsx` | Date-only values (visit date, licensing due date) are stored at UTC midnight but were formatted with `toLocaleDateString()` (no `timeZone:'UTC'`), so users west of UTC saw the **previous** calendar day — inconsistent with the rest of the app. | **Fixed** — added `fmtDateUTC` and used it for visit + licensing dates. |
| 2 | Low | `src/app/api/agency/report/route.ts` | CSV export sanitized `"`/`,` but a staff name starting with `=`/`+`/`-`/`@` could be interpreted as a formula by spreadsheet apps (CSV/formula injection). | **Fixed** — cells starting with a formula char are now prefixed with `'`, and CR/LF stripped. |
| 3 | Low | `src/components/message-thread.tsx`, `src/components/agency-portal.tsx` | Message-thread `fetch` in `useEffect` had no mounted/abort guard; closing the panel or switching homes before it resolved could `setState` on a replaced/unmounted instance (React warning + stale flash). | **Fixed** — both effects now use an `active` flag and ignore late responses. |
| 4 | Cosmetic | `src/components/resource-configs.ts` | The Foster-Closet `needed` (Boolean) column uses `kind:'enum'`, which renders `True`/`False` rather than the field's Yes/No labels. (Note: Foster Closet was unlinked from the nav in favour of the Visit Log; the page/API remain.) | **Open** — cosmetic, in an unlinked page; deferred. |
| 5 | Nit | `src/lib/validation.ts` (+ agency routes / `agency-portal.tsx`) | `GoalStatus` / `VisitStatus` string literals are repeated in several `z.enum([...])` lists and the component instead of being centralized in `src/lib/enums.ts` like the other enums. | **Open** — refactor nit; no functional impact. Tie to the Prisma enums in `enums.ts` when convenient. |

## Verification

`tsc --noEmit` clean · 66 unit tests pass · `next build` passes.
