import type { AdminRole } from '@prisma/client';

/**
 * Granular admin (platform-staff) permissions, mapped per AdminRole.
 * `globalRole === 'ADMIN'` gates access to the admin console; this map decides
 * what an admin may actually do inside it. An admin with no explicit adminRole
 * is treated as SUPER_ADMIN (backward compatibility for the seeded admin).
 */

export type AdminPermission =
  | 'users.view'
  | 'users.edit'
  | 'users.suspend'
  | 'users.delete'
  | 'users.note'
  | 'admins.manage'
  | 'payments.view'
  | 'payments.refund'
  | 'settings.update'
  | 'content.moderate'
  | 'support.manage'
  | 'analytics.view'
  | 'system.view'
  | 'logs.view'
  | 'reports.export'
  | 'plans.manage'; // edit plan commercial fields (SUPER_ADMIN only)

const ALL: AdminPermission[] = [
  'users.view', 'users.edit', 'users.suspend', 'users.delete', 'users.note',
  'admins.manage', 'payments.view', 'payments.refund', 'settings.update',
  'content.moderate', 'support.manage', 'analytics.view', 'system.view',
  'logs.view', 'reports.export', 'plans.manage',
];

const MATRIX: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ['users.view', 'users.edit', 'users.suspend', 'users.note', 'payments.view', 'content.moderate', 'support.manage', 'analytics.view', 'system.view', 'logs.view', 'reports.export'],
  MANAGER: ['users.view', 'payments.view', 'analytics.view', 'system.view', 'logs.view', 'reports.export'],
  SUPPORT: ['users.view', 'users.note', 'users.edit', 'support.manage'],
  MODERATOR: ['users.view', 'users.suspend', 'content.moderate', 'support.manage'],
  FINANCE_ADMIN: ['payments.view', 'payments.refund', 'reports.export', 'users.view'],
  READ_ONLY: ['users.view', 'payments.view', 'analytics.view', 'system.view', 'logs.view'],
};

/** Resolve an effective admin role (null/legacy admins act as SUPER_ADMIN). */
export function effectiveAdminRole(adminRole: AdminRole | null | undefined): AdminRole {
  return adminRole ?? 'SUPER_ADMIN';
}

export function adminCan(adminRole: AdminRole | null | undefined, perm: AdminPermission): boolean {
  return MATRIX[effectiveAdminRole(adminRole)].includes(perm);
}

export const ADMIN_ROLES: AdminRole[] = [
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'MODERATOR', 'FINANCE_ADMIN', 'READ_ONLY',
];
