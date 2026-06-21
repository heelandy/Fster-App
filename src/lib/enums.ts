/**
 * Single source of truth for the enum value lists used by BOTH the Zod schemas
 * (API contract) and the UI option dropdowns. Keeps schema, validation and forms
 * from drifting out of sync. These mirror the enums in prisma/schema.prisma.
 */

export const PLACEMENT_STATUS = [
  'PENDING',
  'ACTIVE',
  'RESPITE',
  'TRIAL_HOME_VISIT',
  'REUNIFIED',
  'ADOPTED',
  'ENDED',
] as const;

export const APPOINTMENT_TYPE = [
  'DOCTOR',
  'THERAPY',
  'DENTAL',
  'COURT',
  'SCHOOL_MEETING',
  'CASEWORKER_VISIT',
  'HOME_INSPECTION',
  'LICENSING_DEADLINE',
  'OTHER',
] as const;

export const CONTACT_ROLE = [
  'CASEWORKER',
  'LICENSING_WORKER',
  'GAL',
  'ATTORNEY',
  'THERAPIST',
  'DOCTOR',
  'DENTIST',
  'TEACHER',
  'SCHOOL_COUNSELOR',
  'BIOLOGICAL_FAMILY',
  'EMERGENCY',
  'OTHER',
] as const;

export const EXPENSE_CATEGORY = [
  'CLOTHING',
  'SCHOOL_SUPPLIES',
  'FOOD',
  'HYGIENE',
  'ACTIVITIES',
  'TRANSPORTATION',
  'MEDICAL',
  'CHILDCARE',
  'ROOM_SETUP',
  'OTHER',
] as const;

export const DOCUMENT_CATEGORY = [
  'PLACEMENT',
  'MEDICAL',
  'SCHOOL',
  'COURT',
  'LICENSING',
  'RECEIPT',
  'CASE_NOTE',
  'OTHER',
] as const;

export const LICENSING_STATUS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'DUE_SOON', 'EXPIRED'] as const;

export const ROUTINE_TYPE = [
  'MORNING',
  'AFTER_SCHOOL',
  'BEDTIME',
  'VISIT_DAY',
  'SCHOOL_DAY',
  'INTAKE',
  'HOME_INSPECTION',
  'MEDICATION',
  'CUSTOM',
] as const;

export const MED_LOG_STATUS = ['GIVEN', 'MISSED', 'REFUSED'] as const;

export const COURT_HEARING_TYPE = [
  'PRELIMINARY',
  'ADJUDICATION',
  'DISPOSITION',
  'REVIEW',
  'PERMANENCY',
  'TERMINATION',
  'ADOPTION',
  'STATUS_CONFERENCE',
  'OTHER',
] as const;

export const EDUCATION_RECORD_TYPE = [
  'ENROLLMENT',
  'IEP',
  'MEETING',
  'GRADE_REPORT',
  'ATTENDANCE',
  'CONCERN',
  'ACHIEVEMENT',
  'OTHER',
] as const;

// Foster-parent training categories (Phase 14). Free-form `category` on TrainingHour.
export const TRAINING_CATEGORY = [
  'Orientation',
  'Annual',
  'CPR',
  'First Aid',
  'Trauma-Informed Care',
  'Behavioral Support',
  'Other',
] as const;

export const HOUSEHOLD_ROLE = ['CO_PARENT', 'BABYSITTER'] as const;

/** Human-readable label for an enum value (e.g. SCHOOL_MEETING -> "School Meeting"). */
export function humanize(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build {value,label} option objects for a <select>. */
export function toOptions(values: readonly string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: v.replaceAll('_', ' ') }));
}
