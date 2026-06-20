import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyPlacementOverrideSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Agency-admin override: force a placement to a given status regardless of the
 * foster parent's accept/deny. Forcing an ACTIVE/TRIAL placement also stamps the
 * parent response as ACCEPTED so the lifecycle stays consistent.
 */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'placements:override');
    mutationGuard('agency-placement-override', ctx.userId, RateLimits.write);
    const { status } = await readJson(req, agencyPlacementOverrideSchema);

    const placement = await prisma.placement.findUnique({
      where: { id: params.id },
      select: { id: true, child: { select: { id: true, household: { select: { agencyId: true } } } } },
    });
    if (!placement || placement.child.household.agencyId !== ctx.agencyId) throw Errors.notFound();

    const active = status === 'ACTIVE' || status === 'TRIAL_HOME_VISIT';
    const now = new Date();
    await prisma.$transaction([
      prisma.placement.update({
        where: { id: params.id },
        data: {
          status,
          parentResponse: active ? 'ACCEPTED' : undefined,
          respondedAt: active ? now : undefined,
          endDate: active ? null : now,
        },
      }),
      prisma.childProfile.update({ where: { id: placement.child.id }, data: { placementStatus: status } }),
    ]);

    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_PLACEMENT_OVERRIDE', metadata: { agencyId: ctx.agencyId, placementId: params.id, status } });
    return json({ ok: true, status });
  });
}
