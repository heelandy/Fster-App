import { describe, it, expect } from 'vitest';
import {
  registerSchema, childSchema, expenseSchema, contactSchema,
  adminUserActionSchema, adminCreateUserSchema, adminRefundSchema, adminCreditSchema,
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
