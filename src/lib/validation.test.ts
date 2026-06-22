import { describe, it, expect } from 'vitest';
import {
  registerSchema, childSchema, expenseSchema, contactSchema,
  adminUserActionSchema, adminCreateUserSchema, adminRefundSchema, adminCreditSchema,
  householdVisitSchema,
} from './validation';

describe('registerSchema password policy', () => {
  const base = { name: 'Pat', email: 'pat@example.com', householdName: 'Home' };
  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'alllowercase1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'NoNumbersHere' }).success).toBe(false);
  });
  it('accepts a strong password and lowercases the email', () => {
    const r = registerSchema.safeParse({ ...base, email: 'Pat@Example.COM', password: 'GoodPass123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('pat@example.com');
  });
});

describe('registerSchema roles', () => {
  const creds = { name: 'Pat', email: 'pat@example.com', password: 'GoodPass123' };
  it('defaults to FOSTER_PARENT and requires a household name', () => {
    const ok = registerSchema.safeParse({ ...creds, householdName: 'Home' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.role).toBe('FOSTER_PARENT');
    expect(registerSchema.safeParse(creds).success).toBe(false); // no householdName
  });
  it('requires an agency name when role is AGENCY', () => {
    expect(registerSchema.safeParse({ ...creds, role: 'AGENCY', agencyName: 'Bright Futures' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...creds, role: 'AGENCY' }).success).toBe(false); // no agencyName
  });
});

describe('householdVisitSchema', () => {
  it('requires visitor and reason (summary)', () => {
    expect(householdVisitSchema.safeParse({ visitDate: '2026-01-01', visitor: 'Jane', summary: 'Monthly check-in' }).success).toBe(true);
    expect(householdVisitSchema.safeParse({ visitDate: '2026-01-01', summary: 'x' }).success).toBe(false); // no visitor
    expect(householdVisitSchema.safeParse({ visitDate: '2026-01-01', visitor: 'Jane' }).success).toBe(false); // no reason
  });
});

describe('childSchema', () => {
  it('requires a first name', () => {
    expect(childSchema.safeParse({}).success).toBe(false);
  });
  it('accepts minimal valid input and defaults status', () => {
    const r = childSchema.safeParse({ firstName: 'Alex' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.placementStatus).toBe('ACTIVE');
  });
});

describe('expenseSchema', () => {
  it('coerces amountCents and requires a description', () => {
    const r = expenseSchema.safeParse({ description: 'Shoes', amountCents: '2500', spentAt: '2026-01-01' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amountCents).toBe(2500);
  });
  it('rejects negative amounts', () => {
    expect(
      expenseSchema.safeParse({ description: 'x', amountCents: -5, spentAt: '2026-01-01' }).success,
    ).toBe(false);
  });
});

describe('contactSchema', () => {
  it('accepts empty optional email/phone', () => {
    const r = contactSchema.safeParse({ name: 'Dr. Lee', role: 'DOCTOR', email: '', phone: '' });
    expect(r.success).toBe(true);
  });
  it('rejects malformed email', () => {
    expect(contactSchema.safeParse({ name: 'X', email: 'not-an-email' }).success).toBe(false);
  });
});

describe('adminUserActionSchema', () => {
  it('accepts known actions and rejects unknown ones', () => {
    expect(adminUserActionSchema.safeParse({ action: 'forceLogout' }).success).toBe(true);
    expect(adminUserActionSchema.safeParse({ action: 'sendPasswordReset' }).success).toBe(true);
    expect(adminUserActionSchema.safeParse({ action: 'nuke' }).success).toBe(false);
  });
  it('normalises the email for editProfile', () => {
    const r = adminUserActionSchema.safeParse({ action: 'editProfile', name: 'New', email: 'New@Example.COM' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('new@example.com');
  });
});

describe('adminCreateUserSchema', () => {
  it('requires name + valid email and lowercases the email', () => {
    const r = adminCreateUserSchema.safeParse({ name: 'Sam', email: 'Sam@Example.COM' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('sam@example.com');
  });
  it('rejects an invalid adminRole', () => {
    expect(adminCreateUserSchema.safeParse({ name: 'Sam', email: 's@e.com', adminRole: 'GOD' }).success).toBe(false);
  });
});

describe('admin finance schemas', () => {
  it('allows a full refund (no amount) and a valid partial amount', () => {
    expect(adminRefundSchema.safeParse({}).success).toBe(true);
    expect(adminRefundSchema.safeParse({ amountCents: 500, reason: 'requested_by_customer' }).success).toBe(true);
    expect(adminRefundSchema.safeParse({ amountCents: 0 }).success).toBe(false);
  });
  it('requires a household id and positive credit amount', () => {
    expect(adminCreditSchema.safeParse({ householdId: 'x', amountCents: 100 }).success).toBe(false); // not a cuid
    expect(adminCreditSchema.safeParse({ householdId: 'clz0000000000000000000000', amountCents: -1 }).success).toBe(false);
  });
});
