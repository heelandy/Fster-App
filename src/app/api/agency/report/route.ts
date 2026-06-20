import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tally = (rows: { status: string | null; _count: { _all: number } }[]) =>
  Object.fromEntries(rows.map((r) => [r.status ?? 'UNKNOWN', r._count._all]));

/**
 * Agency analytics: placement / incident / goal breakdowns, compliance and visit
 * counts, plus per-staff performance (placements & visits created). `?format=csv`
 * returns the staff table as CSV.
 */
export function GET(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:view');

    const homes = await prisma.household.findMany({ where: { agencyId: ctx.agencyId }, select: { id: true } });
    const homeIds = homes.map((h) => h.id);

    const [placementsByStatus, incidentsByStatus, goalsByStatus, visitsScheduled, visitsCompleted, compliance, staff, placementsByStaff, visitsByStaff] =
      await Promise.all([
        prisma.placement.groupBy({ by: ['status'], where: { child: { householdId: { in: homeIds } } }, _count: { _all: true } }),
        prisma.incident.groupBy({ by: ['status'], where: { household: { agencyId: ctx.agencyId } }, _count: { _all: true } }),
        prisma.goal.groupBy({ by: ['status'], where: { household: { agencyId: ctx.agencyId } }, _count: { _all: true } }),
        prisma.visit.count({ where: { householdId: { in: homeIds }, status: 'SCHEDULED' } }),
        prisma.visit.count({ where: { householdId: { in: homeIds }, status: 'COMPLETED' } }),
        prisma.licensingRequirement.count({ where: { householdId: { in: homeIds }, status: { in: ['DUE_SOON', 'EXPIRED'] } } }),
        prisma.agencyMember.findMany({ where: { agencyId: ctx.agencyId }, select: { userId: true, role: true, user: { select: { name: true, email: true } } } }),
        prisma.placement.groupBy({ by: ['createdById'], where: { child: { householdId: { in: homeIds } } }, _count: { _all: true } }),
        prisma.visit.groupBy({ by: ['createdById'], where: { householdId: { in: homeIds } }, _count: { _all: true } }),
      ]);

    const pMap = Object.fromEntries(placementsByStaff.map((r) => [r.createdById ?? '', r._count._all]));
    const vMap = Object.fromEntries(visitsByStaff.map((r) => [r.createdById ?? '', r._count._all]));
    const staffPerf = staff.map((s) => ({
      name: s.user.name || s.user.email,
      role: s.role,
      placements: pMap[s.userId] ?? 0,
      visits: vMap[s.userId] ?? 0,
    }));

    if (new URL(req.url).searchParams.get('format') === 'csv') {
      const header = 'Staff,Role,Placements,Visits';
      const body = staffPerf.map((s) => `${s.name.replace(/[",]/g, ' ')},${s.role},${s.placements},${s.visits}`).join('\n');
      return new Response(`${header}\n${body}\n`, {
        status: 200,
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="agency-staff-report.csv"', 'Cache-Control': 'no-store' },
      });
    }

    return json({
      placementsByStatus: tally(placementsByStatus),
      incidentsByStatus: tally(incidentsByStatus),
      goalsByStatus: tally(goalsByStatus),
      visits: { scheduled: visitsScheduled, completed: visitsCompleted },
      complianceAlerts: compliance,
      staffPerformance: staffPerf,
    });
  });
}
