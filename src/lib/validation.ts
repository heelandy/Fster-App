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

export const registerSchema = z.object({
  name: shortText,
  email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()),
  password,
  householdName: shortText,
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
  stripeSecretKey: z.string().trim().max(255).optional(),
  stripePublishableKey: z.string().trim().max(255).optional(),
  stripeWebhookSecret: z.string().trim().max(255).optional(),
  resendApiKey: z.string().trim().max(255).optional(),
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
});

// ── Email-based household invites ──
// (Invite creation reuses inviteMemberSchema above — same shape, normalised email.)
export const acceptInviteSchema = z.object({
  token: z.string().min(10).max(200),
  name: optionalShort,
  password: password.optional(),
});
