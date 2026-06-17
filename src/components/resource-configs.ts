import type { FieldDef, ColumnDef } from './crud-resource';
import {
  APPOINTMENT_TYPE,
  CONTACT_ROLE,
  EXPENSE_CATEGORY,
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
