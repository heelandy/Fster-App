import { describe, it, expect } from 'vitest';
import { registerSchema, childSchema, expenseSchema, contactSchema } from './validation';

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
