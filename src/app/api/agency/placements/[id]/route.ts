import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyPlacementUpdateSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Update a placement's status — e.g. mark REUNIFIED (or ENDED). Scoped to the
 * caller's agency via the placement's child → household → agencyId.
 */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'placements:manage');
    mutationGuard('agency-placement', ctx.userId, RateLimits.write);
    const { status } = await readJson(req, agencyPlacementUpdateSchema);

    const placement = await prisma.placement.findUnique({
      where: { id: params.id },
      select: { id: true, child: { select: { household: { select: { agencyId: true } } } } },
    });
    if (!placement || placement.child.household.agencyId !== ctx.agencyId) throw Errors.notFound();

    await prisma.placement.update({
      where: { id: params.id },
      data: { status, endDate: status === 'ACTIVE' ? null : new Date() },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_PLACEMENT_UPDATED', metadata: { agencyId: ctx.agencyId, placementId: params.id, status } });
    return json({ ok: true });
  });
}
