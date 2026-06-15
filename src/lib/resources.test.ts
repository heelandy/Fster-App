import { describe, it, expect } from 'vitest';
import { contactResource } from './resources';
import type { HouseholdContext } from './authz';

const ctx = {} as HouseholdContext;

describe('contact isLegal transform (regression for code-review #7)', () => {
  const transform = contactResource.transform!;

  it('flags legal roles as isLegal on create', () => {
    expect((transform({ role: 'ATTORNEY' }, ctx) as { isLegal: boolean }).isLegal).toBe(true);
    expect((transform({ role: 'GAL' }, ctx) as { isLegal: boolean }).isLegal).toBe(true);
    expect((transform({ role: 'CASEWORKER' }, ctx) as { isLegal: boolean }).isLegal).toBe(true);
  });

  it('flags care roles as not legal', () => {
    expect((transform({ role: 'THERAPIST' }, ctx) as { isLegal: boolean }).isLegal).toBe(false);
    expect((transform({ role: 'DOCTOR' }, ctx) as { isLegal: boolean }).isLegal).toBe(false);
  });

  it('recomputes isLegal when role changes on edit (THERAPIST -> ATTORNEY)', () => {
    expect((transform({ role: 'ATTORNEY' }, ctx) as { isLegal: boolean }).isLegal).toBe(true);
  });

  it('does NOT touch isLegal on a partial edit that omits role', () => {
    const out = transform({ phone: '555-0100' }, ctx) as Record<string, unknown>;
    expect('isLegal' in out).toBe(false);
  });
});
