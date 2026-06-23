import { z } from 'zod';
import {
  PLACEMENT_STATUS,
  APPOINTMENT_TYPE,
  CONTACT_ROLE,
  EXPENSE_CATEGORY,
  DOCUMENT_CATEGORY,
  LICENSING_STATUS,
  ROUTINE_TYPE,
  MED_LOG_STATUS,
  HOUSEHOLD_ROLE,
  COURT_HEARING_TYPE,
  EDUCATION_RECORD_TYPE,
} from './enums';

/**
 * Centralised input validation. Every API mutation parses its body through one of
 * these schemas before touching the database. Combined with Prisma's parameterised
 * queries (no string concatenation) this closes off SQL injection, and bounded
 * string lengths reduce stored-XSS / abuse surface.
 */

const shortText = z.string().trim().min(1).max(200);
const optionalShort = z.string().trim().max(200).optional().or(z.literal('').transform(() => undefined));
const longText = z.string().trim().max(5000).optional().or(z.literal('').transform(() => undefined));
const isoDate = z.coerce.date();
const optionalDate = z.coerce.date().optional();

// Strong-ish password policy: length + mix. Hashing uses bcrypt cost 12.
export const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const registerSchema = z
  .object({
    name: shortText,
    email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
    password,
    // Sign up as a foster parent (creates a household) or an agency (creates an
    // agency the user becomes admin of). Defaults to FOSTER_PARENT for back-compat.
    role: z.enum(['FOSTER_PARENT', 'AGENCY']).default('FOSTER_PARENT'),
    householdName: optionalShort,
    agencyName: optionalShort,
    // Cloudflare Turnstile token — only required/verified when CAPTCHA is configured.
    captchaToken: z.string().max(4000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'AGENCY') {
      if (!data.agencyName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agencyName'], message: 'Agency name is required.' });
    } else if (!data.householdName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['householdName'], message: 'Household name is required.' });
    }
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const householdSchema = z.object({
  name: shortText,
});

// Canonical invite payload — used for both "add existing member" and email
// invites. Email is normalised (lowercase + trim) here so callers don't repeat it.
export const inviteMemberSchema = z.object({
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
  role: z.enum(HOUSEHOLD_ROLE),
  deny: z.array(z.string()).optional(),
});

export const childSchema = z.object({
  firstName: shortText,
  preferredName: optionalShort,
  lastName: optionalShort,
  dateOfBirth: optionalDate,
  placementStatus: z.enum(PLACEMENT_STATUS).default('ACTIVE'),
  caseNumber: optionalShort,
  caseworkerName: optionalShort,
  school: optionalShort,
  doctorName: optionalShort,
  allergies: longText,
  importantNotes: longText,
  emergencyContactName: optionalShort,
  emergencyContactPhone: z.string().trim().max(40).optional().or(z.literal('').transform(() => undefined)),
});

export const placementSchema = z.object({
  status: z.enum(PLACEMENT_STATUS),
  placementDate: isoDate,
  endDate: optionalDate,
  agency: optionalShort,
  notes: longText,
});

export const appointmentSchema = z.object({
  childId: z.string().cuid().optional(),
  title: shortText,
  type: z.enum(APPOINTMENT_TYPE).default('OTHER'),
  location: optionalShort,
  startsAt: isoDate,
  endsAt: optionalDate,
  reminderAt: optionalDate,
  notes: longText,
});

export const documentMetaSchema = z.object({
  title: shortText,
  category: z.enum(DOCUMENT_CATEGORY).default('OTHER'),
  childId: z.string().cuid().optional(),
});

export const careLogSchema = z.object({
  childId: z.string().cuid(),
  logDate: isoDate,
  meals: longText,
  sleep: longText,
  behavior: longText,
  mood: optionalShort,
  schoolUpdate: longText,
  visits: longText,
  medicalConcerns: longText,
  incidents: longText,
  milestones: longText,
  generalNotes: longText,
});

export const medicationSchema = z.object({
  childId: z.string().cuid(),
  name: shortText,
  dosage: optionalShort,
  schedule: optionalShort,
  startDate: optionalDate,
  endDate: optionalDate,
  prescribingDoctor: optionalShort,
  notes: longText,
  isActive: z.boolean().default(true),
});

export const medicationLogSchema = z.object({
  givenAt: isoDate,
  status: z.enum(MED_LOG_STATUS).default('GIVEN'),
  notes: optionalShort,
});

export const expenseSchema = z.object({
  childId: z.string().cuid().optional(),
  category: z.enum(EXPENSE_CATEGORY).default('OTHER'),
  description: shortText,
  amountCents: z.coerce.number().int().min(0).max(100_000_00),
  spentAt: isoDate,
});

export const contactSchema = z.object({
  childId: z.string().cuid().optional(),
  name: shortText,
  role: z.enum(CONTACT_ROLE).default('OTHER'),
  phone: z.string().trim().max(40).optional().or(z.literal('').transform(() => undefined)),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  agency: optionalShort,
  notes: longText,
});

export const routineSchema = z.object({
  name: shortText,
  type: z.enum(ROUTINE_TYPE).default('CUSTOM'),
  description: longText,
  childId: z.string().cuid().optional(),
  tasks: z.array(shortText).max(100).optional(),
});

export const checklistSchema = z.object({
  name: shortText,
  type: routineSchema.shape.type,
  childId: z.string().cuid().optional(),
  items: z.array(shortText).max(100).optional(),
});

export const toggleSchema = z.object({ isDone: z.boolean() });

export const licensingSchema = z.object({
  name: shortText,
  category: optionalShort,
  status: z.enum(LICENSING_STATUS).default('NOT_STARTED'),
  dueDate: optionalDate,
  completedAt: optionalDate,
  notes: longText,
});

export const trainingHourSchema = z.object({
  title: shortText,
  hours: z.coerce.number().min(0).max(1000),
  completedAt: isoDate,
  provider: optionalShort,
  category: optionalShort,
  expiresAt: optionalDate,
});

// ── Records cluster: court hearings, education records, immunizations ──
export const courtHearingSchema = z.object({
  childId: z.string().cuid().optional(),
  type: z.enum(COURT_HEARING_TYPE).default('OTHER'),
  hearingDate: isoDate,
  location: optionalShort,
  judge: optionalShort,
  attorney: optionalShort,
  outcome: longText,
  nextHearingDate: optionalDate,
  notes: longText,
});

export const educationRecordSchema = z.object({
  childId: z.string().cuid(),
  type: z.enum(EDUCATION_RECORD_TYPE).default('OTHER'),
  recordDate: isoDate,
  school: optionalShort,
  grade: optionalShort,
  // Select sends 'true'/'false'; coerce.boolean() would make BOTH true.
  hasIep: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional(),
  notes: longText,
});

export const immunizationSchema = z.object({
  childId: z.string().cuid(),
  vaccine: shortText,
  dateGiven: isoDate,
  nextDoseDate: optionalDate,
  provider: optionalShort,
  notes: longText,
});

export const checkoutSchema = z.object({
  tier: z.enum(['FAMILY', 'PRO', 'AGENCY']),
  interval: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
  promoCode: z.string().trim().max(60).optional(),
});

// ── Account recovery & security ──
export const forgotPasswordSchema = z.object({
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password,
});

export const twoFactorVerifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10).max(200),
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

// ── Support tickets ──
export const supportTicketSchema = z.object({
  subject: shortText,
  message: z.string().trim().min(1).max(5000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
});

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']),
});

// ── SuperAdmin integration config ──
// All fields optional: only the keys present are updated. Empty string clears a
// value (falls back to env). Secrets are stored encrypted at rest.
export const integrationConfigSchema = z.object({
  // Secret keys are intentionally NOT here — they're env-only and can't be set
  // through the app (so they're never exposed in a UI or accepted over the API).
  emailFrom: z.string().trim().max(255).optional(),
  prices: z
    .record(
      z.enum(['FAMILY', 'PRO', 'AGENCY']),
      z.object({
        MONTHLY: z.string().trim().max(255).optional(),
        ANNUAL: z.string().trim().max(255).optional(),
      }),
    )
    .optional(),
  // Optional Stripe Payment Link URLs per plan (https://buy.stripe.com/…). Empty
  // string clears the link (reverting that plan to the Checkout Session flow).
  paymentLinks: z
    .record(
      z.enum(['FAMILY', 'PRO', 'AGENCY']),
      z.object({
        MONTHLY: z.string().trim().max(500).optional(),
        ANNUAL: z.string().trim().max(500).optional(),
      }),
    )
    .optional(),
});

// ── Email-based household invites ──
// (Invite creation reuses inviteMemberSchema above — same shape, normalised email.)
export const acceptInviteSchema = z.object({
  token: z.string().min(10).max(200),
  name: optionalShort,
  password: password.optional(),
});

// ── Admin: user management actions ──
const ADMIN_ROLE_VALUES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'MODERATOR', 'FINANCE_ADMIN', 'READ_ONLY'] as const;

// Single-record actions on /api/admin/users/[id]. `value` carries the note or
// admin-role string; `name`/`email` are only used by the editProfile action.
export const adminUserActionSchema = z.object({
  action: z.enum([
    'suspend', 'reactivate', 'ban', 'unban', 'unlock', 'note', 'setAdminRole',
    'verify', 'forceLogout', 'sendPasswordReset', 'editProfile', 'restore',
  ]),
  value: z.string().max(2000).optional(),
  name: z.string().trim().max(200).optional(),
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()).optional(),
});

// Admin-created account. No password is set by the admin — the new user receives
// a set-password email. An optional adminRole provisions staff accounts.
export const adminCreateUserSchema = z.object({
  name: shortText,
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
  householdName: optionalShort,
  adminRole: z.enum(ADMIN_ROLE_VALUES).optional(),
});

// ── Admin: finance ──
export const adminRefundSchema = z.object({
  // Omit amountCents for a full refund; supply it for a partial refund.
  amountCents: z.coerce.number().int().min(1).max(100_000_00).optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

export const adminCreditSchema = z.object({
  householdId: z.string().cuid(),
  amountCents: z.coerce.number().int().min(1).max(100_000_00),
  note: z.string().trim().max(500).optional(),
});

// ── Multi-agency platform ──
export const agencyCreateSchema = z.object({
  name: shortText,
});
export const agencyStaffSchema = z.object({
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
  role: z.enum(['AGENCY_ADMIN', 'CASE_WORKER', 'AGENCY_VIEWER']),
});
export const agencyLinkHomeSchema = z.object({
  // Link a foster home to the agency by its owner's email.
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
});
// Create a NEW foster home for a foster parent (must be an existing user).
export const agencyCreateHomeSchema = z.object({
  homeName: shortText,
  fosterParentEmail: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
});
// Assign/place a child into a home — child fields + an optional trial end date.
export const agencyAssignChildSchema = childSchema.extend({
  trialEndDate: z.coerce.date().optional(),
});
// Submit a licensing/compliance item for the foster parent to complete.
export const agencyLicensingSchema = z.object({
  name: shortText,
  category: optionalShort,
  dueDate: optionalDate,
});
export const agencyPlacementUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'REUNIFIED', 'ENDED']),
});
// Record a caseworker/agency visit to a foster home (home-level record).
export const agencyVisitSchema = z.object({
  visitDate: z.coerce.date(),
  visitType: optionalShort,
  summary: longText,
});
// A foster parent logs an (often unscheduled) visit to their own home. The visitor
// ("who") and the reason (summary) are both required.
export const householdVisitSchema = z.object({
  visitDate: isoDate,
  visitType: optionalShort,
  visitor: shortText,
  summary: z.string().trim().min(1).max(5000),
  childId: z.string().cuid().optional(),
});
// A foster parent accepts (Y) or declines (N) an assigned placement.
export const placementRespondSchema = z.object({
  decision: z.enum(['ACCEPTED', 'DECLINED']),
});
// A foster parent approves or denies an agency's request to oversee their home.
export const oversightRespondSchema = z.object({
  decision: z.enum(['APPROVED', 'DENIED']),
});
// Agency sets a home's approval/suspension status.
export const agencyHomeStatusSchema = z.object({
  fosterStatus: z.enum(['PENDING', 'APPROVED', 'SUSPENDED']),
});
// Agency moves a child from one of its homes to another of its homes.
export const agencyTransferSchema = z.object({
  childId: z.string().trim().min(1).max(40),
  toHomeId: z.string().trim().min(1).max(40),
});
// Agency broadcasts an announcement to its homes.
export const announcementSchema = z.object({
  title: shortText,
  body: longText,
});
// Foster parent reports an incident about a placement.
export const incidentCreateSchema = z.object({
  title: shortText,
  description: longText,
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  childId: optionalShort,
});
// Agency case worker reviews / escalates / resolves an incident.
export const incidentUpdateSchema = z.object({
  status: z.enum(['REPORTED', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED']),
  resolution: longText,
});

// ── Caregiver feature CRUD (household-scoped, via the resource factory) ──
export const behaviorLogSchema = z.object({
  childId: shortText,
  logDate: isoDate,
  trigger: optionalShort,
  emotion: optionalShort,
  coping: optionalShort,
  intervention: optionalShort,
  strength: optionalShort,
  notes: longText,
});
export const inventorySchema = z.object({
  childId: optionalShort,
  name: shortText,
  category: optionalShort,
  size: optionalShort,
  quantity: z.coerce.number().int().min(0).max(100_000).optional(),
  // Select sends the strings 'true'/'false'; coerce.boolean() would make BOTH true.
  needed: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional(),
  notes: longText,
});
export const communicationLogSchema = z.object({
  childId: optionalShort,
  contactId: optionalShort,
  logDate: isoDate,
  method: optionalShort,
  summary: shortText,
});
export const journalSchema = z.object({
  childId: shortText,
  entryDate: isoDate,
  title: optionalShort,
  body: z.string().trim().min(1).max(5000),
});

// ── Agency: case goals, secure messages, scheduled-visit completion, override ──
export const agencyGoalSchema = z.object({
  childId: optionalShort,
  title: shortText,
  description: longText,
  status: z.enum(['OPEN', 'IN_PROGRESS', 'MET', 'CANCELLED']).default('OPEN'),
  targetDate: optionalDate,
});
export const agencyGoalUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'MET', 'CANCELLED']),
});
export const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
export const agencyVisitUpdateSchema = z.object({
  status: z.enum(['SCHEDULED', 'COMPLETED']),
});
// Agency admin overrides a placement decision (force a status, bypassing accept/deny).
export const agencyPlacementOverrideSchema = z.object({
  status: z.enum(['ACTIVE', 'TRIAL_HOME_VISIT', 'REUNIFIED', 'ENDED']),
});

// SUPER_ADMIN edits a plan's commercial fields (name/description/prices/active) via
// the admin UI. Feature gating + limits are NOT here — they stay code-defined.
export const adminPlanUpdateSchema = z.object({
  tier: z.enum(['FREE', 'FAMILY', 'PRO', 'AGENCY']),
  name: shortText.optional(),
  description: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
  priceCentsMonthly: z.coerce.number().int().min(0).max(1_000_000_00).optional(),
  priceCentsAnnual: z.coerce.number().int().min(0).max(1_000_000_00).optional(),
  isActive: z.boolean().optional(),
  // Opt-in: also push changed prices to Stripe (creates a new Stripe Price, archives
  // the old one). Not a Plan column — handled separately in the route, never persisted.
  syncStripe: z.boolean().optional(),
});

// Manually grant/override a household's plan (comp / grant / scholarship account),
// resolved by the owner's email. A paid tier is "comped" (Stripe reconcile skips
// it); granting FREE clears the comp and hands control back to Stripe.
export const adminGrantPlanSchema = z.object({
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
  tier: z.enum(['FREE', 'FAMILY', 'PRO', 'AGENCY']),
  note: z.string().trim().max(500).optional(),
});
