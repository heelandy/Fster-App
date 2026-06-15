import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    const users = await prisma.user.findMany({
      // Admins manage accounts — never expose password hashes or child data.
      select: {
        id: true,
        name: true,
        email: true,
        globalRole: true,
        isActive: true,
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
