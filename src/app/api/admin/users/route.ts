import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

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
