import { describe, it, expect } from 'vitest';
import { adminCan, effectiveAdminRole } from './admin';

describe('admin permission matrix', () => {
  it('SUPER_ADMIN can do everything', () => {
    expect(adminCan('SUPER_ADMIN', 'users.delete')).toBe(true);
    expect(adminCan('SUPER_ADMIN', 'admins.manage')).toBe(true);
    expect(adminCan('SUPER_ADMIN', 'settings.update')).toBe(true);
  });

  it('legacy admin (null role) is treated as SUPER_ADMIN', () => {
    expect(effectiveAdminRole(null)).toBe('SUPER_ADMIN');
    expect(adminCan(null, 'settings.update')).toBe(true);
  });

  it('ADMIN can manage users but not delete them or manage admins/settings', () => {
    expect(adminCan('ADMIN', 'users.suspend')).toBe(true);
    expect(adminCan('ADMIN', 'users.delete')).toBe(false);
    expect(adminCan('ADMIN', 'admins.manage')).toBe(false);
    expect(adminCan('ADMIN', 'settings.update')).toBe(false);
  });

  it('FINANCE_ADMIN can refund but not suspend users', () => {
    expect(adminCan('FINANCE_ADMIN', 'payments.refund')).toBe(true);
    expect(adminCan('FINANCE_ADMIN', 'users.suspend')).toBe(false);
  });

  it('READ_ONLY can only view', () => {
    expect(adminCan('READ_ONLY', 'users.view')).toBe(true);
    expect(adminCan('READ_ONLY', 'users.suspend')).toBe(false);
    expect(adminCan('READ_ONLY', 'settings.update')).toBe(false);
  });

  it('SUPPORT cannot delete or suspend', () => {
    expect(adminCan('SUPPORT', 'users.note')).toBe(true);
    expect(adminCan('SUPPORT', 'users.delete')).toBe(false);
    expect(adminCan('SUPPORT', 'users.suspend')).toBe(false);
  });
});
