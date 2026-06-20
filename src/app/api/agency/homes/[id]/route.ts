import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: { id: string } };

/**
 * Oversight detail for one of the agency's homes: children (case fields, NOT
 * medical/private notes), placements, licensing/compliance, upcoming appointments.
 * Read-only — agency staff oversee; the foster parent still manages the home.
 */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:view');
    const home = await requireAgencyHome(ctx, params.id);

    // A trial placement whose trial date has passed becomes ACTIVE (placed until
    // reunified) — applied lazily on view so it needs no background job.
    await prisma.placement.updateMany({
      where: { child: { householdId: home.id }, status: 'TRIAL_HOME_VISIT', endDate: { lt: new Date() } },
      data: { status: 'ACTIVE', endDate: null },
    });

    const [owner, children, placements, licensing, visits, goals, trainingHours, upcomingAppointments] = await Promise.all([
      prisma.user.findUnique({ where: { id: home.ownerId }, select: { name: true, email: true } }),
      prisma.childProfile.findMany({
        where: { householdId: home.id },
        // Case-oversight fields only — no medical (allergies/notes) in the MVP.
        select: { id: true, firstName: true, preferredName: true, placementStatus: true, dateOfBirth: true, school: true, caseNumber: true, caseworkerName: true },
        orderBy: { firstName: 'asc' },
      }),
      prisma.placement.findMany({
        where: { child: { householdId: home.id } },
        select: { id: true, status: true, placementDate: true, endDate: true, agency: true, child: { select: { firstName: true, preferredName: true } } },
        orderBy: { placementDate: 'desc' },
        take: 50,
      }),
      prisma.licensingRequirement.findMany({
        where: { householdId: home.id },
        select: { id: true, name: true, status: true, dueDate: true },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      }),
      prisma.visit.findMany({
        where: { householdId: home.id },
        select: { id: true, visitDate: true, visitType: true, summary: true, status: true },
        orderBy: { visitDate: 'desc' },
        take: 50,
      }),
      prisma.goal.findMany({
        where: { householdId: home.id },
        select: { id: true, title: true, description: true, status: true, targetDate: true },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.trainingHour.aggregate({ where: { householdId: home.id }, _sum: { hours: true }, _count: { _all: true } }),
      prisma.appointment.count({ where: { householdId: home.id, startsAt: { gte: new Date() } } }),
    ]);

    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_HOME_VIEWED', metadata: { agencyId: ctx.agencyId, householdId: home.id } });
    return json({
      home: { id: home.id, name: home.name, fosterStatus: home.fosterStatus, ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null },
      children,
      placements,
      licensing,
      visits,
      goals,
      trainingHours: { totalHours: trainingHours._sum.hours ?? 0, count: trainingHours._count._all },
      upcomingAppointments,
    });
  });
}

/** Unlink a home from the agency (oversight ends; the foster parent keeps it). */
export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:manage');
    mutationGuard('agency-homes', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);
    await prisma.household.update({ where: { id: home.id }, data: { agencyId: null } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_HOME_UNLINKED', metadata: { agencyId: ctx.agencyId, householdId: home.id } });
    return json({ ok: true });
  });
}
