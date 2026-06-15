# Data Model

PostgreSQL via Prisma. Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).
All tenant data hangs off `Household`; sensitive data is access-controlled in the app layer.

## Entity map

```
User ──owns──► Household ──has──► HouseholdMember ──► User
                  │
                  ├── ChildProfile ──► Placement
                  │                ├── Appointment*        (childId optional)
                  │                ├── Document*           (childId optional)
                  │                ├── DailyCareLog
                  │                ├── Medication ──► MedicationLog
                  │                ├── Expense* ──► Receipt (childId optional)
                  │                └── Contact*            (childId optional)
                  ├── Routine ──► RoutineTask
                  ├── Checklist ──► ChecklistItem
                  ├── LicensingRequirement
                  ├── TrainingHour
                  └── Subscription ──► Payment, Invoice

Plan (catalogue)            ProcessedWebhookEvent (Stripe idempotency)
AdminAuditLog               SecurityAuditLog
```
\* also carries a direct `householdId` for fast, scoped queries.

## Models

### Auth & tenancy
| Model | Purpose | Key fields |
|---|---|---|
| **User** | An account. | `email` (unique), `passwordHash` (bcrypt), `globalRole` (USER/ADMIN), `isActive`, `failedLogins`, `lockedUntil`, `lastLoginAt` |
| **Household** | The tenant; everything is scoped to it. | `name`, `ownerId`, `stripeCustomerId` |
| **HouseholdMember** | Links a user to a household with a role. | `role` (FOSTER_PARENT/CO_PARENT/BABYSITTER), `permissions` (JSON allow/deny overrides), `acceptedAt` |

### Children & care
| Model | Purpose | Sensitive fields |
|---|---|---|
| **ChildProfile** | Core child record. | `caseNumber`, `caseworkerName`, `importantNotes` (stripped for babysitters) |
| **Placement** | Placement history for a child. | `status`, `placementDate`, `endDate`, `agency` |
| **Appointment** | Calendar event. | `type`, `startsAt`, `reminderAt` |
| **Document** | Uploaded file metadata. | `storageKey` (opaque, never exposed), `category`, `mimeType`, `sizeBytes` |
| **DailyCareLog** | One day's notes for a child. | meals/sleep/behavior/mood/school/visits/medical/incidents/milestones |
| **Medication** | A prescription. | `name`, `dosage`, `schedule`, `prescribingDoctor`, `isActive` |
| **MedicationLog** | Give/miss/refuse record. | `givenAt`, `status` |
| **Expense** | A foster-care expense. | `category`, `amountCents`, `spentAt` |
| **Receipt** | File attached to an expense. | `storageKey` |
| **Contact** | A person/agency. | `role`, `isLegal` (hides court/legal contacts from babysitters) |

### Routines, checklists, licensing
| Model | Purpose |
|---|---|
| **Routine** / **RoutineTask** | Reusable routine with completable tasks. |
| **Checklist** / **ChecklistItem** | Reusable checklist with completable items (+ `doneAt`). |
| **LicensingRequirement** | A compliance item with `status` and `dueDate`. |
| **TrainingHour** | Logged training hours. |

### Billing
| Model | Purpose |
|---|---|
| **Plan** | Display catalogue (tier, prices, Stripe price ids). Gating logic lives in `lib/plans.ts`. |
| **Subscription** | Household's billing state: `tier`, `status`, `interval`, `currentPeriodEnd`, `graceUntil`, `cancelAtPeriodEnd`, `trialEndsAt`. |
| **Payment** | A recorded charge (from webhooks). |
| **Invoice** | Invoice/receipt metadata (`hostedInvoiceUrl`, `pdfUrl`). |

### Platform / audit
| Model | Purpose |
|---|---|
| **AdminAuditLog** | Admin actions (actor, action, target, metadata). |
| **SecurityAuditLog** | Security events (logins, denials, downloads, rate-limits, webhook-signature failures). |
| **ProcessedWebhookEvent** | Stripe event ids already processed (idempotency). |

## Enums (single source: `src/lib/enums.ts` mirrors `schema.prisma`)

- **GlobalRole**: USER, ADMIN
- **HouseholdRole**: FOSTER_PARENT, CO_PARENT, BABYSITTER
- **PlanTier**: FREE, FAMILY, PRO, AGENCY · **BillingInterval**: MONTHLY, ANNUAL
- **SubscriptionStatus**: TRIALING, ACTIVE, PAST_DUE, GRACE, CANCELED, INCOMPLETE, UNPAID
- **PlacementStatus**: PENDING, ACTIVE, RESPITE, TRIAL_HOME_VISIT, REUNIFIED, ADOPTED, ENDED
- **AppointmentType**: DOCTOR, THERAPY, DENTAL, COURT, SCHOOL_MEETING, CASEWORKER_VISIT, HOME_INSPECTION, LICENSING_DEADLINE, OTHER
- **ContactRole**: CASEWORKER, LICENSING_WORKER, GAL, ATTORNEY, THERAPIST, DOCTOR, DENTIST, TEACHER, SCHOOL_COUNSELOR, BIOLOGICAL_FAMILY, EMERGENCY, OTHER
- **ExpenseCategory**: CLOTHING, SCHOOL_SUPPLIES, FOOD, HYGIENE, ACTIVITIES, TRANSPORTATION, MEDICAL, CHILDCARE, ROOM_SETUP, OTHER
- **DocumentCategory**: PLACEMENT, MEDICAL, SCHOOL, COURT, LICENSING, RECEIPT, CASE_NOTE, OTHER
- **LicensingStatus**: NOT_STARTED, IN_PROGRESS, COMPLETE, DUE_SOON, EXPIRED
- **RoutineType**: MORNING, AFTER_SCHOOL, BEDTIME, VISIT_DAY, SCHOOL_DAY, INTAKE, HOME_INSPECTION, MEDICATION, CUSTOM

## Notable indexes & constraints
- `User.email` unique; `Household.stripeCustomerId` unique; `Subscription.householdId` unique.
- `HouseholdMember` unique on `(householdId, userId)`.
- Composite read indexes: `Appointment(householdId, startsAt)`, `DailyCareLog(householdId, logDate)`, `Expense(householdId, spentAt)`, `LicensingRequirement(householdId, dueDate)`.
- Cascade deletes from `Household`/`ChildProfile` so removing a household cleans up its data.
