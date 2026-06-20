import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Which portals the signed-in user can use — drives role-based redirect after
 * login. (Static segment, so it sits alongside NextAuth's [...nextauth] catch-all.)
 */
export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [household, agency] = await Promise.all([
      prisma.householdMember.findFirst({ where: { userId: user.id }, select: { id: true } }),
      prisma.agencyMember.findFirst({ where: { userId: user.id }, select: { role: true } }),
    ]);
    return json({ hasHousehold: !!household, agencyRole: agency?.role ?? null, isAdmin: user.role === 'ADMIN' });
  });
}
