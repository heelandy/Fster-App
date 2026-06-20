import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyGoalUpdateSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Update a case goal's status (case worker). */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'goals:manage');
    mutationGuard('agency-goal-update', ctx.userId, RateLimits.write);
    const { status } = await readJson(req, agencyGoalUpdateSchema);

    const goal = await prisma.goal.findUnique({ where: { id: params.id }, select: { id: true, household: { select: { agencyId: true } } } });
    if (!goal || goal.household.agencyId !== ctx.agencyId) throw Errors.notFound();

    await prisma.goal.update({ where: { id: params.id }, data: { status } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_GOAL_UPDATED', metadata: { agencyId: ctx.agencyId, goalId: params.id, status } });
    return json({ ok: true, status });
  });
}
