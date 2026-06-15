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
const password = z
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

export const inviteMemberSchema = z.object({
  email: z.string().email(),
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
