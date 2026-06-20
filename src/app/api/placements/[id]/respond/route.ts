import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { placementRespondSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Foster parent accepts or declines a child a case worker assigned to their home.
 * The Y/N decision is recorded on the placement. Accept → TRIAL_HOME_VISIT (the
 * trial clock set at assignment starts); decline → ENDED. Only a PENDING placement
 * in the caller's own household can be answered, and only once.
 */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:write');
    mutationGuard('placement-respond', ctx.userId, RateLimits.write);
    const { decision } = await readJson(req, placementRespondSchema);

    const placement = await prisma.placement.findUnique({
      where: { id: params.id },
      select: { id: true, parentResponse: true, child: { select: { id: true, householdId: true } } },
    });
    if (!placement || placement.child.householdId !== ctx.householdId) throw Errors.notFound();
    if (placement.parentResponse !== 'PENDING') throw Errors.badRequest('This placement has already been answered.');

    const accepted = decision === 'ACCEPTED';
    const now = new Date();
    await prisma.$transaction([
      prisma.placement.update({
        where: { id: placement.id },
        data: {
          parentResponse: decision,
          respondedAt: now,
          status: accepted ? 'TRIAL_HOME_VISIT' : 'ENDED',
          ...(accepted ? {} : { endDate: now }),
        },
      }),
      prisma.childProfile.update({
        where: { id: placement.child.id },
        data: { placementStatus: accepted ? 'TRIAL_HOME_VISIT' : 'ENDED' },
      }),
    ]);

    await logSecurity({
      actorId: ctx.userId,
      event: 'PLACEMENT_RESPONSE',
      metadata: { householdId: ctx.householdId, placementId: placement.id, decision },
    });
    return json({ ok: true, decision });
  });
}
