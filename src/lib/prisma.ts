import { PrismaClient, Prisma } from '@prisma/client';
import { encryptString, decryptString } from './crypto';

/**
 * Sensitive fields encrypted at rest, per model. Encryption happens transparently
 * in a Prisma middleware: values are encrypted on create/update/upsert and
 * decrypted on every read result — so every call site (API routes, the resource
 * factory, and server components reading Prisma directly) gets it for free.
 *
 * Note: encrypted fields cannot be used in `where` filters or ordering. We only
 * filter/sort on non-encrypted fields (ids, householdId, childId, dates), so this
 * is fine. Amounts (`amountCents`) stay plaintext so aggregates still work.
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  User: ['twoFactorSecret'],
  ChildProfile: [
    'caseNumber',
    'caseworkerName',
    'doctorName',
    'allergies',
    'importantNotes',
    'emergencyContactName',
    'emergencyContactPhone',
  ],
  Placement: ['notes'],
  Medication: ['name', 'dosage', 'notes', 'prescribingDoctor'],
  MedicationLog: ['notes'],
  DailyCareLog: [
    'meals',
    'sleep',
    'behavior',
    'mood',
    'schoolUpdate',
    'visits',
    'medicalConcerns',
    'incidents',
    'milestones',
    'generalNotes',
  ],
  Contact: ['phone', 'email', 'notes'],
  Expense: ['description'],
};

function encryptInPlace(data: Record<string, unknown>, fields: string[]) {
  for (const f of fields) {
    const v = data[f];
    if (typeof v === 'string' && v.length > 0) data[f] = encryptString(v);
  }
}

function decryptInPlace(obj: unknown, fields: string[]) {
  if (!obj || typeof obj !== 'object') return;
  const rec = obj as Record<string, unknown>;
  for (const f of fields) {
    const v = rec[f];
    if (typeof v === 'string' && v.length > 0) {
      try {
        rec[f] = decryptString(v);
      } catch {
        // Leave as-is if it can't be decrypted (corrupt or wrong key).
      }
    }
  }
}

const encryptionMiddleware: Prisma.Middleware = async (params, next) => {
  const fields = params.model ? ENCRYPTED_FIELDS[params.model] : undefined;

  if (fields && params.args) {
    if ((params.action === 'create' || params.action === 'update') && params.args.data) {
      encryptInPlace(params.args.data, fields);
    } else if (params.action === 'upsert') {
      if (params.args.create) encryptInPlace(params.args.create, fields);
      if (params.args.update) encryptInPlace(params.args.update, fields);
    } else if (params.action === 'createMany' && Array.isArray(params.args.data)) {
      params.args.data.forEach((d: Record<string, unknown>) => encryptInPlace(d, fields));
    }
  }

  const result = await next(params);

  if (fields && result) {
    if (Array.isArray(result)) result.forEach((r) => decryptInPlace(r, fields));
    else decryptInPlace(result, fields);
  }
  return result;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  client.$use(encryptionMiddleware);
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
