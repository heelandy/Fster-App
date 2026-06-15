import { describe, it, expect } from 'vitest';
import { can, effectiveTier, sanitizeChildForRole, type Capability } from './authz';
import type { Subscription } from '@prisma/client';

const noPerms = { permissions: {} as Record<string, never> };

describe('RBAC capability matrix', () => {
  it('foster parent can manage everything', () => {
    const ctx = { role: 'FOSTER_PARENT' as const, ...noPerms };
    const caps: Capability[] = ['household:manage', 'billing:manage', 'documents:write', 'legal:read', 'licensing:write'];
    for (const c of caps) expect(can(ctx, c)).toBe(true);
  });

  it('co-parent cannot manage household, billing or members', () => {
    const ctx = { role: 'CO_PARENT' as const, ...noPerms };
    expect(can(ctx, 'household:manage')).toBe(false);
    expect(can(ctx, 'billing:manage')).toBe(false);
    expect(can(ctx, 'members:manage')).toBe(false);
    // but can manage day-to-day data
    expect(can(ctx, 'children:write')).toBe(true);
    expect(can(ctx, 'documents:write')).toBe(true);
  });

  it('babysitter is read-only, limited scope, no documents/legal/expenses', () => {
    const ctx = { role: 'BABYSITTER' as const, ...noPerms };
    expect(can(ctx, 'children:read')).toBe(true);
    expect(can(ctx, 'careLogs:read')).toBe(true);
    expect(can(ctx, 'medications:read')).toBe(true);
    expect(can(ctx, 'routines:read')).toBe(true);
    // explicitly denied
    expect(can(ctx, 'documents:read')).toBe(false);
    expect(can(ctx, 'legal:read')).toBe(false);
    expect(can(ctx, 'expenses:read')).toBe(false);
    expect(can(ctx, 'children:write')).toBe(false);
    expect(can(ctx, 'careLogs:write')).toBe(false);
  });

  it('granular deny overrides a role-granted capability', () => {
    const ctx = { role: 'CO_PARENT' as const, permissions: { deny: ['documents:write'] as Capability[] } };
    expect(can(ctx, 'documents:write')).toBe(false);
    expect(can(ctx, 'children:write')).toBe(true);
  });

  it('granular allow can grant an extra capability to a babysitter', () => {
    const ctx = { role: 'BABYSITTER' as const, permissions: { allow: ['careLogs:write'] as Capability[] } };
    expect(can(ctx, 'careLogs:write')).toBe(true);
    expect(can(ctx, 'documents:read')).toBe(false);
  });
});

describe('effectiveTier (billing → access)', () => {
  const base = (over: Partial<Subscription>): Subscription =>
    ({ tier: 'PRO', status: 'ACTIVE', ...over }) as Subscription;

  it('no subscription = FREE', () => {
    expect(effectiveTier(null)).toBe('FREE');
  });
  it('active/trialing/grace/past_due retain the paid tier', () => {
    expect(effectiveTier(base({ status: 'ACTIVE' }))).toBe('PRO');
    expect(effectiveTier(base({ status: 'TRIALING' }))).toBe('PRO');
    expect(effectiveTier(base({ status: 'GRACE' }))).toBe('PRO');
    expect(effectiveTier(base({ status: 'PAST_DUE' }))).toBe('PRO');
  });
  it('canceled/unpaid/incomplete drop to FREE (access removed)', () => {
    expect(effectiveTier(base({ status: 'CANCELED' }))).toBe('FREE');
    expect(effectiveTier(base({ status: 'UNPAID' }))).toBe('FREE');
    expect(effectiveTier(base({ status: 'INCOMPLETE' }))).toBe('FREE');
  });
});

describe('sanitizeChildForRole', () => {
  const child = {
    firstName: 'Alex',
    caseNumber: 'CASE-1',
    caseworkerName: 'J. Rivera',
    importantNotes: 'sensitive',
    allergies: 'Peanuts',
  };
  it('strips case/legal fields for babysitters', () => {
    const out = sanitizeChildForRole(child, 'BABYSITTER');
    expect(out.caseNumber).toBeUndefined();
    expect(out.caseworkerName).toBeUndefined();
    expect(out.importantNotes).toBeUndefined();
    // care-relevant info stays
    expect(out.allergies).toBe('Peanuts');
    expect(out.firstName).toBe('Alex');
  });
  it('leaves data intact for foster parents and co-parents', () => {
    expect(sanitizeChildForRole(child, 'FOSTER_PARENT').caseNumber).toBe('CASE-1');
    expect(sanitizeChildForRole(child, 'CO_PARENT').caseNumber).toBe('CASE-1');
  });
});
