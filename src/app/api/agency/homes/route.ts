import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyLinkHomeSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Foster homes overseen by the agency, with per-home oversight metrics. */
export function GET() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:view');

    const homes = await prisma.household.findMany({
      where: { agencyId: ctx.agencyId },
      select: { id: true, name: true, fosterStatus: true, owner: { select: { name: true, email: true } } },
      orderBy: { name: 'asc' },
    });
    const ids = homes.map((h) => h.id);

    const [childGroups, licGroups] = await Promise.all([
      prisma.childProfile.groupBy({ by: ['householdId'], where: { householdId: { in: ids } }, _count: { _all: true } }),
      prisma.licensingRequirement.groupBy({ by: ['householdId'], where: { householdId: { in: ids }, status: { in: ['DUE_SOON', 'EXPIRED'] } }, _count: { _all: true } }),
    ]);
    const cMap = Object.fromEntries(childGroups.map((g) => [g.householdId, g._count._all]));
    const lMap = Object.fromEntries(licGroups.map((g) => [g.householdId, g._count._all]));

    return json(
      homes.map((h) => ({
        id: h.id,
        name: h.name,
        fosterStatus: h.fosterStatus,
        ownerName: h.owner.name,
        ownerEmail: h.owner.email,
        children: cMap[h.id] ?? 0,
        complianceAlerts: lMap[h.id] ?? 0,
      })),
    );
  });
}

/** Link a foster home to the agency by its owner's email. Agency-admin only. */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:manage');
    mutationGuard('agency-homes', ctx.userId, RateLimits.write);
    const { email } = await readJson(req, agencyLinkHomeSchema);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw Errors.badRequest('No user with that email.');
    const home = await prisma.household.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, agencyId: true },
    });
    if (!home) throw Errors.badRequest('That user does not own a foster home.');
    if (home.agencyId && home.agencyId !== ctx.agencyId) throw Errors.conflict('That home is already overseen by another agency.');

    await prisma.household.update({ where: { id: home.id }, data: { agencyId: ctx.agencyId } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_HOME_LINKED', metadata: { agencyId: ctx.agencyId, householdId: home.id } });
    return json({ id: home.id, name: home.name }, 201);
  });
}
