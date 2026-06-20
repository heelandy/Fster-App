import { prisma } from './prisma';
import type { ResourceConfig } from './household-resource';
import {
  appointmentSchema,
  careLogSchema,
  medicationSchema,
  expenseSchema,
  contactSchema,
  licensingSchema,
  behaviorLogSchema,
  inventorySchema,
  communicationLogSchema,
  journalSchema,
} from './validation';

// Cast each Prisma delegate to the loose factory shape (signatures are compatible at runtime).
const asDelegate = (d: unknown) => d as ResourceConfig<never>['delegate'];

const childInclude = { child: { select: { firstName: true, preferredName: true } } };

const LEGAL_CONTACT_ROLES = ['GAL', 'ATTORNEY', 'CASEWORKER', 'LICENSING_WORKER', 'BIOLOGICAL_FAMILY'];

export const appointmentResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.appointment),
  scope: 'appointments',
  readCap: 'appointments:read',
  writeCap: 'appointments:write',
  schema: appointmentSchema,
  childField: 'optional',
  include: childInclude,
  orderBy: { startsAt: 'asc' },
  limit: 'maxAppointments', // FREE plan caps appointment count
};

export const careLogResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.dailyCareLog),
  scope: 'care-logs',
  readCap: 'careLogs:read',
  writeCap: 'careLogs:write',
  feature: 'careLogs',
  schema: careLogSchema,
  childField: 'required',
  include: childInclude,
  orderBy: { logDate: 'desc' },
  stamp: (ctx) => ({ authorId: ctx.userId }),
};

export const medicationResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.medication),
  scope: 'medications',
  readCap: 'medications:read',
  writeCap: 'medications:write',
  feature: 'medications',
  schema: medicationSchema,
  childField: 'required',
  include: childInclude,
  orderBy: { createdAt: 'desc' },
};

export const expenseResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.expense),
  scope: 'expenses',
  readCap: 'expenses:read',
  writeCap: 'expenses:write',
  feature: 'expenses',
  schema: expenseSchema,
  childField: 'optional',
  include: childInclude,
  orderBy: { spentAt: 'desc' },
  stamp: (ctx) => ({ createdById: ctx.userId }),
};

export const contactResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.contact),
  scope: 'contacts',
  readCap: 'contacts:read',
  writeCap: 'contacts:write',
  schema: contactSchema,
  childField: 'optional',
  include: childInclude,
  orderBy: { createdAt: 'desc' },
  // Babysitters never see legal/court-linked contacts.
  listWhere: (ctx) => (ctx.role === 'BABYSITTER' ? { isLegal: false } : {}),
  // Derive isLegal from role. Only recompute when role is part of the payload so
  // a partial edit of other fields doesn't reset the flag.
  transform: (data) =>
    'role' in data
      ? { ...data, isLegal: LEGAL_CONTACT_ROLES.includes(String(data.role)) }
      : data,
};

export const licensingResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.licensingRequirement),
  scope: 'licensing',
  readCap: 'licensing:read',
  writeCap: 'licensing:write',
  feature: 'licensingTracker',
  schema: licensingSchema,
  orderBy: { dueDate: 'asc' },
};

export const behaviorLogResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.behaviorLog),
  scope: 'behavior-logs',
  readCap: 'behaviorLogs:read',
  writeCap: 'behaviorLogs:write',
  schema: behaviorLogSchema,
  childField: 'required',
  include: childInclude,
  orderBy: { logDate: 'desc' },
  stamp: (ctx) => ({ authorId: ctx.userId }),
};

export const inventoryResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.inventoryItem),
  scope: 'inventory',
  readCap: 'inventory:read',
  writeCap: 'inventory:write',
  schema: inventorySchema,
  childField: 'optional',
  include: childInclude,
  orderBy: { createdAt: 'desc' },
};

export const communicationResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.communicationLog),
  scope: 'communications',
  readCap: 'communications:read',
  writeCap: 'communications:write',
  schema: communicationLogSchema,
  childField: 'optional',
  include: childInclude,
  orderBy: { logDate: 'desc' },
  stamp: (ctx) => ({ authorId: ctx.userId }),
};

export const journalResource: ResourceConfig<Record<string, unknown>> = {
  delegate: asDelegate(prisma.journalEntry),
  scope: 'journal',
  readCap: 'journal:read',
  writeCap: 'journal:write',
  schema: journalSchema,
  childField: 'required',
  include: childInclude,
  orderBy: { entryDate: 'desc' },
  stamp: (ctx) => ({ authorId: ctx.userId }),
};
