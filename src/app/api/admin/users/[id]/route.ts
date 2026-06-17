import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { ADMIN_ROLES } from '@/lib/admin';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';
import { generateToken } from '@/lib/tokens';
import { sendPasswordReset } from '@/lib/email';
import { adminUserActionSchema } from '@/lib/validation';
import { env } from '@/lib/env';
import type { AdminPermission } from '@/lib/admin';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Which permission each action requires.
const ACTION_PERM: Record<string, AdminPermission> = {
  suspend: 'users.suspend',
  reactivate: 'users.suspend',
  ban: 'users.suspend',
  unban: 'users.suspend',
  unlock: 'users.suspend',
  note: 'users.note',
  setAdminRole: 'admins.manage',
  verify: 'users.edit',
  forceLogout: 'users.suspend',
  sendPasswordReset: 'users.edit',
  editProfile: 'users.edit',
  restore: 'users.delete',
};

export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const admin = await requireAdmin();
    mutationGuard('admin-users', admin.id, RateLimits.write);
    const body = await readJson(req, adminUserActionSchema);
    const { action } = body;

    // Enforce the per-action permission.
    await requireAdminPermission(ACTION_PERM[action]);

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, email: true, name: true, isActive: true, isBanned: true,
        internalNote: true, adminRole: true, globalRole: true,
        tokenVersion: true, emailVerifiedAt: true, deletedAt: true,
      },
    });
    if (!target) throw Errors.notFound();
    if (target.id === admin.id && (action === 'suspend' || action === 'ban' || action === 'forceLogout')) {
      throw Errors.badRequest('You cannot perform that action on your own account.');
    }

    // ── Side-effect-only action: trigger a password-reset email (no field change).
    // The admin never sees or sets the password — only sends the self-serve link.
    if (action === 'sendPasswordReset') {
      if (!target.isActive || target.isBanned || target.deletedAt) {
        throw Errors.badRequest('Cannot send a reset to a disabled account.');
      }
      const { raw, hash } = generateToken();
      await prisma.passwordResetToken.deleteMany({ where: { userId: target.id, usedAt: null } });
      await prisma.passwordResetToken.create({
        data: { userId: target.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_EXPIRY_MS) },
      });
      await sendPasswordReset(target.email, `${env.APP_URL}/reset-password?token=${raw}`);
      await logAdmin({ actorId: admin.id, action: 'USER_SEND_PASSWORD_RESET', targetType: 'User', targetId: target.id });
      return json({ ok: true });
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
      case 'note': data = { internalNote: body.value ?? null }; oldValue = target.internalNote; newValue = body.value ?? null; break;
      case 'verify': data = { emailVerifiedAt: new Date() }; oldValue = target.emailVerifiedAt; newValue = 'verified'; break;
      case 'forceLogout': data = { tokenVersion: { increment: 1 } }; oldValue = target.tokenVersion; newValue = target.tokenVersion + 1; break;
      case 'restore': data = { deletedAt: null, isActive: true }; oldValue = 'deleted'; newValue = 'restored'; break;
      case 'editProfile': {
        const name = body.name?.trim();
        const email = body.email;
        if (!name && !email) throw Errors.badRequest('Provide a name or email to update.');
        if (email && email !== target.email) {
          const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
          if (clash && clash.id !== target.id) throw Errors.conflict('That email is already in use.');
        }
        data = { ...(name ? { name } : {}), ...(email ? { email } : {}) };
        oldValue = { name: target.name, email: target.email };
        newValue = data;
        break;
      }
      case 'setAdminRole': {
        if (body.value && !ADMIN_ROLES.includes(body.value as never)) throw Errors.badRequest('Invalid admin role.');
        const adminRole = body.value ? (body.value as never) : null;
        // Granting any admin role also flags the account as a global ADMIN; clearing it reverts to USER.
        data = { adminRole, globalRole: body.value ? 'ADMIN' : 'USER' };
        oldValue = target.adminRole;
        newValue = body.value ?? null;
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
    // Soft delete: deactivate + tombstone (deletedAt) and revoke sessions, retaining
    // the record for recovery and audit integrity (no hard delete of system records).
    await prisma.user.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false, tokenVersion: { increment: 1 } },
    });
    await logAdmin({ actorId: admin.id, action: 'USER_DELETE', targetType: 'User', targetId: params.id });
    return json({ ok: true });
  });
}
