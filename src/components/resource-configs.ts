import type { FieldDef, ColumnDef } from './crud-resource';
import {
  APPOINTMENT_TYPE,
  CONTACT_ROLE,
  EXPENSE_CATEGORY,
  COURT_HEARING_TYPE,
  EDUCATION_RECORD_TYPE,
  TRAINING_CATEGORY,
  toOptions,
} from '@/lib/enums';

/**
 * Shared field/column definitions for the household resources, reused by both the
 * full section pages and the per-child detail tabs (which pass `fixedChildId`).
 */

export const appointmentFields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'type', label: 'Type', type: 'select', options: toOptions(APPOINTMENT_TYPE) },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
  { name: 'startsAt', label: 'Starts at', type: 'datetime', required: true },
  { name: 'endsAt', label: 'Ends at', type: 'datetime' },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'reminderAt', label: 'Reminder at', type: 'datetime' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const appointmentColumns: ColumnDef[] = [
  { key: 'startsAt', label: 'When', kind: 'datetime', proximity: true },
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type', kind: 'enum' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'location', label: 'Location' },
];

export const careLogFields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'logDate', label: 'Date', type: 'date', required: true },
  { name: 'mood', label: 'Mood', type: 'text' },
  { name: 'meals', label: 'Meals', type: 'textarea' },
  { name: 'sleep', label: 'Sleep', type: 'textarea' },
  { name: 'behavior', label: 'Behavior', type: 'textarea' },
  { name: 'schoolUpdate', label: 'School update', type: 'textarea' },
  { name: 'visits', label: 'Visits', type: 'textarea' },
  { name: 'medicalConcerns', label: 'Medical concerns', type: 'textarea' },
  { name: 'incidents', label: 'Incidents', type: 'textarea' },
  { name: 'milestones', label: 'Milestones', type: 'textarea' },
  { name: 'generalNotes', label: 'General notes', type: 'textarea' },
];
export const careLogColumns: ColumnDef[] = [
  { key: 'logDate', label: 'Date', kind: 'date' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'mood', label: 'Mood' },
  { key: 'behavior', label: 'Behavior' },
];

export const medicationFields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'name', label: 'Medication name', type: 'text', required: true },
  { name: 'dosage', label: 'Dosage', type: 'text', placeholder: 'e.g. 5mg' },
  { name: 'schedule', label: 'Schedule', type: 'text', placeholder: 'e.g. Twice daily, 8am & 8pm' },
  { name: 'startDate', label: 'Start date', type: 'date' },
  { name: 'endDate', label: 'End date', type: 'date' },
  { name: 'prescribingDoctor', label: 'Prescribing doctor', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const medicationColumns: ColumnDef[] = [
  { key: 'name', label: 'Medication' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'dosage', label: 'Dosage' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'prescribingDoctor', label: 'Doctor' },
];

export const expenseFields: FieldDef[] = [
  { name: 'description', label: 'Description', type: 'text', required: true },
  { name: 'category', label: 'Category', type: 'select', options: toOptions(EXPENSE_CATEGORY) },
  { name: 'amountCents', label: 'Amount ($)', type: 'money', required: true },
  { name: 'spentAt', label: 'Date', type: 'date', required: true },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
];
export const expenseColumns: ColumnDef[] = [
  { key: 'spentAt', label: 'Date', kind: 'date' },
  { key: 'category', label: 'Category', kind: 'enum' },
  { key: 'description', label: 'Description' },
  { key: 'amountCents', label: 'Amount', kind: 'money' },
  { key: 'child', label: 'Child', kind: 'childName' },
];

export const contactFields: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'role', label: 'Role', type: 'select', options: toOptions(CONTACT_ROLE) },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'agency', label: 'Agency', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const contactColumns: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role', kind: 'enum' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'agency', label: 'Agency' },
];

// Behaviour & trauma tracking (TBRI-style).
export const behaviorFields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'logDate', label: 'Date', type: 'date', required: true },
  { name: 'trigger', label: 'Trigger', type: 'textarea', placeholder: 'What set it off?' },
  { name: 'emotion', label: 'Emotion / pattern', type: 'text' },
  { name: 'coping', label: 'Coping strategy', type: 'textarea' },
  { name: 'intervention', label: 'What helped (intervention)', type: 'textarea' },
  { name: 'strength', label: 'Strength shown', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const behaviorColumns: ColumnDef[] = [
  { key: 'logDate', label: 'Date', kind: 'date' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'intervention', label: 'What helped' },
  { key: 'strength', label: 'Strength' },
];

// Foster closet / inventory.
export const inventoryFields: FieldDef[] = [
  { name: 'name', label: 'Item', type: 'text', required: true, placeholder: 'e.g. Winter coat' },
  { name: 'category', label: 'Category', type: 'text', placeholder: 'Clothing, Shoes, Supplies…' },
  { name: 'size', label: 'Size', type: 'text' },
  { name: 'quantity', label: 'Quantity', type: 'number' },
  { name: 'needed', label: 'Restock needed?', type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes — needs restock' }] },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const inventoryColumns: ColumnDef[] = [
  { key: 'name', label: 'Item' },
  { key: 'category', label: 'Category' },
  { key: 'size', label: 'Size' },
  { key: 'quantity', label: 'Qty' },
  { key: 'needed', label: 'Restock', kind: 'enum' },
  { key: 'child', label: 'Child', kind: 'childName' },
];

// Family communication hub (call / email / meeting log).
export const communicationFields: FieldDef[] = [
  { name: 'logDate', label: 'Date', type: 'date', required: true },
  { name: 'method', label: 'Method', type: 'select', options: [
    { value: 'Call', label: 'Call' }, { value: 'Email', label: 'Email' }, { value: 'Meeting', label: 'Meeting' }, { value: 'Text', label: 'Text' }, { value: 'Other', label: 'Other' },
  ] },
  { name: 'summary', label: 'Summary', type: 'textarea', required: true },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
];
export const communicationColumns: ColumnDef[] = [
  { key: 'logDate', label: 'Date', kind: 'date' },
  { key: 'method', label: 'Method' },
  { key: 'summary', label: 'Summary' },
  { key: 'child', label: 'Child', kind: 'childName' },
];

// Child story & success journal.
export const journalFields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'entryDate', label: 'Date', type: 'date', required: true },
  { name: 'title', label: 'Title', type: 'text', placeholder: 'e.g. First day of school' },
  { name: 'body', label: 'Story', type: 'textarea', required: true },
];
export const journalColumns: ColumnDef[] = [
  { key: 'entryDate', label: 'Date', kind: 'date' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'title', label: 'Title' },
];

// Court hearings (Phase 15).
export const courtFields: FieldDef[] = [
  { name: 'type', label: 'Hearing type', type: 'select', options: toOptions(COURT_HEARING_TYPE) },
  { name: 'hearingDate', label: 'Hearing date', type: 'datetime', required: true },
  { name: 'childId', label: 'Child (optional)', type: 'childSelect' },
  { name: 'location', label: 'Court / location', type: 'text' },
  { name: 'judge', label: 'Judge', type: 'text' },
  { name: 'attorney', label: 'Attorney', type: 'text' },
  { name: 'nextHearingDate', label: 'Next hearing', type: 'date' },
  { name: 'outcome', label: 'Outcome / orders', type: 'textarea' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const courtColumns: ColumnDef[] = [
  { key: 'hearingDate', label: 'When', kind: 'datetime', proximity: true },
  { key: 'type', label: 'Type', kind: 'enum' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'judge', label: 'Judge' },
  { key: 'nextHearingDate', label: 'Next', kind: 'date', proximity: true },
];

// Education records (Phase 16).
export const educationFields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'type', label: 'Record type', type: 'select', options: toOptions(EDUCATION_RECORD_TYPE) },
  { name: 'recordDate', label: 'Date', type: 'date', required: true },
  { name: 'school', label: 'School', type: 'text' },
  { name: 'grade', label: 'Grade / score', type: 'text', placeholder: 'e.g. 4th grade, B+' },
  { name: 'hasIep', label: 'On an IEP?', type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes — has an IEP' }] },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const educationColumns: ColumnDef[] = [
  { key: 'recordDate', label: 'Date', kind: 'date' },
  { key: 'type', label: 'Type', kind: 'enum' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'school', label: 'School' },
  { key: 'grade', label: 'Grade' },
  { key: 'hasIep', label: 'IEP', kind: 'enum' },
];

// Immunizations (Phase 17).
export const immunizationFields: FieldDef[] = [
  { name: 'childId', label: 'Child', type: 'childSelect', required: true },
  { name: 'vaccine', label: 'Vaccine', type: 'text', required: true, placeholder: 'e.g. MMR, Flu' },
  { name: 'dateGiven', label: 'Date given', type: 'date', required: true },
  { name: 'nextDoseDate', label: 'Next dose due', type: 'date' },
  { name: 'provider', label: 'Provider', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
export const immunizationColumns: ColumnDef[] = [
  { key: 'dateGiven', label: 'Given', kind: 'date' },
  { key: 'vaccine', label: 'Vaccine' },
  { key: 'child', label: 'Child', kind: 'childName' },
  { key: 'nextDoseDate', label: 'Next dose', kind: 'date', proximity: true },
  { key: 'provider', label: 'Provider' },
];

// Training & certifications (Phase 14).
export const trainingFields: FieldDef[] = [
  { name: 'title', label: 'Course / certificate', type: 'text', required: true, placeholder: 'e.g. CPR Certification' },
  { name: 'category', label: 'Category', type: 'select', options: toOptions(TRAINING_CATEGORY) },
  { name: 'hours', label: 'Hours', type: 'number', required: true },
  { name: 'completedAt', label: 'Completed', type: 'date', required: true },
  { name: 'expiresAt', label: 'Expires / renew by', type: 'date' },
  { name: 'provider', label: 'Provider', type: 'text' },
];
export const trainingColumns: ColumnDef[] = [
  { key: 'completedAt', label: 'Completed', kind: 'date' },
  { key: 'title', label: 'Course' },
  { key: 'category', label: 'Category' },
  { key: 'hours', label: 'Hours' },
  { key: 'expiresAt', label: 'Expires', kind: 'date', proximity: true },
  { key: 'provider', label: 'Provider' },
];
