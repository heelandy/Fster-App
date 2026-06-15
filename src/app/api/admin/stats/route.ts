import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * System-wide overview for admins. Returns AGGREGATE COUNTS ONLY — never any
 * child records, document contents, notes, or other private case data. This
 * lets an admin oversee platform health without "casually viewing" private
 * foster-care information (per the access-control requirement).
 */
export function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    const since24h = new Date(Date.now() - 86_400_000);
    const since7d = new Date(Date.now() - 7 * 86_400_000);

    const [
      users,
      admins,
      households,
      children,
      documents,
      appointmentsUpcoming,
      newUsers7d,
      tierGroups,
      statusGroups,
      failedLogins24h,
      accessDenied24h,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { globalRole: 'ADMIN' } }),
      prisma.household.count(),
      prisma.childProfile.count(),
      prisma.document.count(),
      prisma.appointment.count({ where: { startsAt: { gte: new Date() } } }),
      prisma.user.count({ where: { createdAt: { gte: since7d } } }),
      prisma.subscription.groupBy({ by: ['tier'], _count: { _all: true } }),
      prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.securityAuditLog.count({ where: { event: 'LOGIN_FAILED', createdAt: { gte: since24h } } }),
      prisma.securityAuditLog.count({ where: { event: 'ACCESS_DENIED', createdAt: { gte: since24h } } }),
    ]);

    await logAdmin({ actorId: admin.id, action: 'ADMIN_VIEW_STATS' });

    return json({
      totals: {
        users,
        admins,
        households,
        children, // count only — no records exposed
        documents, // count only — no files exposed
        appointmentsUpcoming,
        newUsers7d,
      },
      subscriptionsByTier: Object.fromEntries(tierGroups.map((g) => [g.tier, g._count._all])),
      subscriptionsByStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
      security24h: { failedLogins: failedLogins24h, accessDenied: accessDenied24h },
    });
  });
}
