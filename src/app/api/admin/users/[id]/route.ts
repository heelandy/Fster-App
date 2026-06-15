import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { ADMIN_ROLES } from '@/lib/admin';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';
import type { AdminPermission } from '@/lib/admin';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

const patchSchema = z.object({
  action: z.enum(['suspend', 'reactivate', 'ban', 'unban', 'unlock', 'note', 'setAdminRole']),
  value: z.string().max(2000).optional(),
});

// Which permission each action requires.
const ACTION_PERM: Record<string, AdminPermission> = {
  suspend: 'users.suspend',
  reactivate: 'users.suspend',
  ban: 'users.suspend',
  unban: 'users.suspend',
  unlock: 'users.suspend',
  note: 'users.note',
  setAdminRole: 'admins.manage',
};

export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const admin = await requireAdmin();
    mutationGuard('admin-users', admin.id, RateLimits.write);
    const { action, value } = await readJson(req, patchSchema);

    // Enforce the per-action permission.
    await requireAdminPermission(ACTION_PERM[action]);

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true, isBanned: true, internalNote: true, adminRole: true, globalRole: true },
    });
    if (!target) throw Errors.notFound();
    if (target.id === admin.id && (action === 'suspend' || action === 'ban')) {
      throw Errors.badRequest('You cannot suspend or ban your own account.');
    }

    let data: Record<string, unknown> = {};
    let oldValue: unknown;
    let newValue: unknown;
    switch (action) {
      case 'suspend': data = { isActive: false }; oldValue = target.isActive; newValue = false; break;
      case 'reactivate': data = { isActive: true }; oldValue = target.isActive; newValue = true; break;
      case 'ban': data = { isBanned: true, isActive: false }; oldValue = target.isBanned; newValue = true; break;
      case 'unban': data = { isBanned: false }; oldValue = target.isBanned; newValue = false; break;
      case 'unlock': data = { failedLogins: 0, lockedUntil: null }; oldValue = 'locked'; newValue = 'unlocked'; break;
      case 'note': data = { internalNote: value ?? null }; oldValue = target.internalNote; newValue = value ?? null; break;
      case 'setAdminRole': {
        if (value && !ADMIN_ROLES.includes(value as never)) throw Errors.badRequest('Invalid admin role.');
        const adminRole = value ? (value as never) : null;
        // Granting any admin role also flags the account as a global ADMIN; clearing it reverts to USER.
        data = { adminRole, globalRole: value ? 'ADMIN' : 'USER' };
        oldValue = target.adminRole;
        newValue = value ?? null;
        break;
      }
    }

    await prisma.user.update({ where: { id: params.id }, data });
    await logAdmin({
      actorId: admin.id,
      action: `USER_${action.toUpperCase()}`,
      targetType: 'User',
      targetId: params.id,
      metadata: { oldValue, newValue },
    });
    return json({ ok: true });
  });
}

export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const admin = await requireAdminPermission('users.delete');
    mutationGuard('admin-users', admin.id, RateLimits.write);
    if (params.id === admin.id) throw Errors.badRequest('You cannot delete your own account.');
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!target) throw Errors.notFound();
    await prisma.user.delete({ where: { id: params.id } });
    await logAdmin({ actorId: admin.id, action: 'USER_DELETE', targetType: 'User', targetId: params.id });
    return json({ ok: true });
  });
}
