import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { generateToken } from '@/lib/tokens';
import { sendAccountSetup } from '@/lib/email';
import { adminCreateUserSchema } from '@/lib/validation';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

const SETUP_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function GET(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('users.view');
    const q = new URL(req.url).searchParams.get('q')?.trim();
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      // Admins manage accounts — never expose password hashes or child data.
      select: {
        id: true,
        name: true,
        email: true,
        globalRole: true,
        adminRole: true,
        isActive: true,
        isBanned: true,
        internalNote: true,
        lockedUntil: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        deletedAt: true,
        createdAt: true,
        _count: { select: { memberships: true, ownedHouseholds: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    await logAdmin({ actorId: admin.id, action: 'ADMIN_VIEW_USERS' });
    return json(users);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('users.edit');
    mutationGuard('admin-users', admin.id, RateLimits.write);
    const data = await readJson(req, adminCreateUserSchema);

    // Provisioning a staff account (any adminRole) is itself privileged.
    if (data.adminRole) await requireAdminPermission('admins.manage');

    const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (existing) throw Errors.conflict('A user with that email already exists.');

    // The admin never sets a password; create a strong throwaway hash and email a
    // set-password link so the user chooses their own credential.
    const throwaway = generateToken().raw;
    const passwordHash = await hashPassword(throwaway);
    const isAdminAccount = !!data.adminRole;
    const householdName = data.householdName?.trim() || `${data.name}'s Household`;

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          ...(isAdminAccount ? { globalRole: 'ADMIN', adminRole: data.adminRole } : {}),
        },
      });
      const household = await tx.household.create({ data: { name: householdName, ownerId: u.id } });
      await tx.householdMember.create({
        data: { householdId: household.id, userId: u.id, role: 'FOSTER_PARENT', acceptedAt: new Date() },
      });
      await tx.subscription.create({ data: { householdId: household.id, tier: 'FREE', status: 'ACTIVE' } });
      return u;
    });

    // Email a set-password link (single-use, hashed token).
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + SETUP_EXPIRY_MS) },
    });
    await sendAccountSetup(data.email, `${env.APP_URL}/reset-password?token=${raw}`);

    await logAdmin({
      actorId: admin.id,
      action: 'USER_CREATE',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: data.email, adminRole: data.adminRole ?? null },
    });
    return json({ ok: true, userId: user.id }, 201);
  });
}
