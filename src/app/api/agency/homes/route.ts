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

/**
 * Request oversight of an existing foster home by its owner's email. Agency-admin
 * only. This does NOT link the home — it records a PENDING request the foster
 * parent must approve in-app before the agency can see anything. The home's
 * `agencyId` stays untouched until the parent approves.
 */
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
    if (home.agencyId === ctx.agencyId) throw Errors.conflict('You already oversee that home.');
    if (home.agencyId) throw Errors.conflict('That home is already overseen by another agency.');

    // A still-pending request is surfaced, not duplicated. Re-requesting after a
    // denial is allowed — the upsert resets the row to PENDING.
    const existing = await prisma.agencyOversightRequest.findUnique({
      where: { agencyId_householdId: { agencyId: ctx.agencyId, householdId: home.id } },
      select: { status: true },
    });
    if (existing?.status === 'PENDING') throw Errors.conflict('A request for that home is already awaiting the foster parent.');

    await prisma.agencyOversightRequest.upsert({
      where: { agencyId_householdId: { agencyId: ctx.agencyId, householdId: home.id } },
      create: { agencyId: ctx.agencyId, householdId: home.id, requestedById: ctx.userId, status: 'PENDING' },
      update: { status: 'PENDING', requestedById: ctx.userId, respondedAt: null, createdAt: new Date() },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_OVERSIGHT_REQUESTED', metadata: { agencyId: ctx.agencyId, householdId: home.id } });
    return json({ requested: true, name: home.name }, 201);
  });
}
