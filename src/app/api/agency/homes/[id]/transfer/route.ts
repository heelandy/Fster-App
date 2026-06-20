import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyTransferSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Move a child from one of the agency's homes to another. The current placement
 * is ended and a fresh PENDING placement is opened in the destination home, so
 * the new foster parent accepts/declines just like a first assignment. The child's
 * placement records stay attached to the child as a transfer history.
 */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'placements:manage');
    mutationGuard('agency-transfer', ctx.userId, RateLimits.write);
    const fromHome = await requireAgencyHome(ctx, params.id);
    const { childId, toHomeId } = await readJson(req, agencyTransferSchema);
    if (toHomeId === fromHome.id) throw Errors.badRequest('Choose a different destination home.');

    // Both homes must belong to the caller's agency, and the child to the source home.
    const toHome = await requireAgencyHome(ctx, toHomeId);
    const child = await prisma.childProfile.findFirst({ where: { id: childId, householdId: fromHome.id }, select: { id: true } });
    if (!child) throw Errors.notFound();

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 86_400_000);
    await prisma.$transaction([
      // End any open placement at the source home.
      prisma.placement.updateMany({
        where: { childId: child.id, status: { in: ['PENDING', 'ACTIVE', 'TRIAL_HOME_VISIT', 'RESPITE'] } },
        data: { status: 'ENDED', endDate: now },
      }),
      prisma.childProfile.update({ where: { id: child.id }, data: { householdId: toHome.id, placementStatus: 'PENDING' } }),
      prisma.placement.create({
        data: { childId: child.id, status: 'PENDING', placementDate: now, endDate: trialEnd, agency: ctx.agencyName, parentResponse: 'PENDING' },
      }),
    ]);

    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_CHILD_TRANSFERRED', metadata: { agencyId: ctx.agencyId, childId: child.id, fromHomeId: fromHome.id, toHomeId: toHome.id } });
    return json({ ok: true });
  });
}
