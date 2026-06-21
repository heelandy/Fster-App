# Foster Care Platform — Gap Analysis & Build Status

Mapping the 30-phase SaaS spec to what exists in the codebase. Markers:
`✅ Done` · `🟡 Partial` · `⬜ Not built` · `➖ Deferred (large/structural or explicitly postponed)`.

> Convention: skip duplicates. Most phases were already implemented in prior batches;
> this file records the true state and what each remaining item needs.

---

## This batch (records cluster — Phases 14–17)

Added four household-scoped CRUD resources via the existing factory (model → Zod →
capability → `ResourceConfig` → routes → page → nav), emoji-free with Lucide icons:

- ✅ **Court Hearings** (`/dashboard/court`, `CourtHearing`) — type, date, judge, attorney, outcome, next date.
- ✅ **Education Records** (`/dashboard/education`, `EducationRecord`) — enrollment, IEP flag, grades, attendance, meetings.
- ✅ **Immunizations** (`/dashboard/immunizations`, `Immunization`) — vaccine, date given, next dose due, provider.
- ✅ **Training & Certifications** (`/dashboard/training`, extended `TrainingHour`) — category + renewal/expiry for CPR / First Aid / trauma-informed.

New capabilities: `court:*`, `education:*`, `medical:*`, `training:*` (foster parent + co-parent full;
babysitter gets `medical:read` only — health yes, legal no).

> ⚠️ **DB migration pending:** the Prisma client is regenerated and the app builds, but the
> new tables/columns must be applied to the database. Run `npx prisma migrate dev --name records_cluster`
> (or `npx prisma db push` locally) before these pages work against a live DB.

Verified: `tsc --noEmit` clean · 66 unit tests pass · `next build` passes.

---

## Full phase map

| Phase | Area | Status | Notes |
|------:|------|--------|-------|
| 1 | Child Management | ✅ | `ChildProfile` + placements, medical/allergies, school, notes, per-child detail. (No photo/gender field yet — 🟡 minor.) |
| 2 | Foster Parent Management | 🟡 | `Household` + members/roles + licensing. No structured address/capacity/beds/vehicle/insurance fields. |
| 3 | Placement Management | ✅ | `Placement` lifecycle (pending→trial→active→reunified/ended), respite, disruptions, transfers. |
| 4 | Matching Engine | ⬜ | No child-needs↔home-capabilities scoring. Needs a capacity/attributes model + scoring service. |
| 5 | Case Management | ✅ | Agency portal: assigned homes/children, visits, court via appts, incidents, goals, case notes. |
| 6 | Licensing Management | ✅ | `LicensingRequirement` + due-date alerts on Today/dashboard. |
| 7 | Home Study Management | 🟡 | Covered via licensing items + documents; no dedicated home-study workflow model. |
| 8 | Visit Management | ✅ | `Visit` (scheduled→completed) + Visit Log; agency-logged, foster-visible. |
| 9 | Biological Family Portal | ➖ | External scoped portal — large; shared-team-portal is a known future item. |
| 10 | Foster Parent Portal | ✅ | This is the core dashboard app. |
| 11 | Child Portal | ➖ | Separate age-appropriate external login surface — large/structural. |
| 12 | Document Management | ✅ | `Document` private storage + categories; expiry via licensing. (Versioning/e-sign 🟡.) |
| 13 | Incident Management | ✅ | `Incident` report→review→escalate→resolve→close workflow. |
| 14 | Training Management | ✅ | **This batch** — Training & Certifications page with category + renewal; agency reporting already surfaced hours. |
| 15 | Court Management | ✅ | **This batch** — Court Hearings resource (was only an appointment `COURT` type before). |
| 16 | Education Management | ✅ | **This batch** — Education Records (enrollment/IEP/grades/attendance). |
| 17 | Medical Management | ✅ | Medications + appointments + **this batch** Immunizations. (Dental/vitals as appts.) |
| 18 | Financial Management | 🟡 | Foster-parent `Expense` + receipts. Stipend/reimbursement/mileage **payout** side ➖ (payroll deferred). |
| 19 | Quality Assurance | 🟡 | Agency reports/analytics tab exists; no formal QA score. |
| 20 | Communication Hub | ✅ | Agency↔home secure messaging, announcements, communication log. (File-share in chat 🟡.) |
| 21 | Compliance Management | 🟡 | Licensing/compliance items + agency oversight; no violations/corrective-action dashboard. |
| 22 | Referral Management | ⬜ | No intake-referral pipeline + source tracking. |
| 23 | Analytics | 🟡 | Agency Reports tab + CSV export; deeper cohort/outcome analytics ➖. |
| 24 | AI Automation Layer | ➖ | Needs Claude API wired (matching, risk, summaries). Deferred. |
| 25 | Multi-Agency SaaS | ✅ | `Agency` tenant + scoped staff oversight; data isolated per agency. |
| 26 | State Compliance Management | ➖ | State reporting/audit packets — deferred. |
| 27 | Recruitment Management | ⬜ | Lead→application→screening→home-study→license pipeline not built. |
| 28 | Adoption Management | 🟡 | `ADOPTED` placement status + keepsake journal/PDF; no dedicated finalization workflow. |
| 29 | Emergency Response | 🟡 | Emergency mode page (critical child info fast-access); no agency-wide disaster dashboard. |
| 30 | Enterprise SaaS | 🟡 | Platform→agency→home→child hierarchy + admin console; region/supervisor/state-network tiers ➖. |

---

## Recommended next buildable batches (pattern-fitting, non-deferred)

1. **Foster Parent Management (2)** — add structured home fields (address, capacity, beds, vehicle, insurance) + a home-profile page.
2. **Referral / Recruitment (22, 27)** — a `Referral` model + simple pipeline stages (a new enum-driven CRUD + a kanban-ish status view).
3. **Compliance/QA dashboards (19, 21)** — aggregate existing licensing/visit/training/incident data into a score + violations list (read-only rollups, no new write surface).
4. **Matching Engine (4)** — once home capacity/attributes (batch 1) exist, add a scoring service over open referrals.

Larger/structural or explicitly deferred: external **portals** (9, 11), **AI** (24), **payroll/state** (18 payout, 26).
