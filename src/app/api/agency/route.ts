import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { requireAgencyMember } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyCreateSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The caller's agency + an at-a-glance oversight summary (scoped to its homes). */
export function GET() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    const homes = await prisma.household.findMany({ where: { agencyId: ctx.agencyId }, select: { id: true } });
    const homeIds = homes.map((h) => h.id);

    const [staff, children, compliance, activePlacements, pendingPlacements, homesWithChildren, openIncidents] = await Promise.all([
      prisma.agencyMember.count({ where: { agencyId: ctx.agencyId } }),
      prisma.childProfile.count({ where: { householdId: { in: homeIds } } }),
      prisma.licensingRequirement.count({ where: { householdId: { in: homeIds }, status: { in: ['DUE_SOON', 'EXPIRED'] } } }),
      prisma.placement.count({ where: { status: 'ACTIVE', child: { householdId: { in: homeIds } } } }),
      // Placement requests awaiting a foster parent's accept/deny.
      prisma.placement.count({ where: { parentResponse: 'PENDING', child: { householdId: { in: homeIds } } } }),
      // Homes that currently hold at least one child (the rest have capacity available).
      prisma.childProfile.findMany({ where: { householdId: { in: homeIds } }, select: { householdId: true }, distinct: ['householdId'] }),
      prisma.incident.count({ where: { household: { agencyId: ctx.agencyId }, status: { in: ['REPORTED', 'UNDER_REVIEW', 'ESCALATED'] } } }),
    ]);
    const availableHomes = homes.length - homesWithChildren.length;

    return json({
      agency: { id: ctx.agencyId, name: ctx.agencyName },
      role: ctx.role,
      totals: {
        homes: homes.length,
        staff,
        children,
        complianceAlerts: compliance,
        activePlacements,
        pendingPlacements,
        availableHomes,
        openIncidents,
      },
    });
  });
}

/** Create an agency. The creator becomes its first AGENCY_ADMIN. */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('agency-create', user.id, RateLimits.write);
    const { name } = await readJson(req, agencyCreateSchema);

    const existing = await prisma.agencyMember.findFirst({ where: { userId: user.id } });
    if (existing) throw Errors.conflict('You already belong to an agency.');

    const agency = await prisma.$transaction(async (tx) => {
      const a = await tx.agency.create({ data: { name } });
      await tx.agencyMember.create({ data: { agencyId: a.id, userId: user.id, role: 'AGENCY_ADMIN' } });
      return a;
    });
    await logSecurity({ actorId: user.id, event: 'AGENCY_CREATED', metadata: { agencyId: agency.id, name } });
    return json({ id: agency.id, name: agency.name }, 201);
  });
}
