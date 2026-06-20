import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyGoalSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Set a case goal for a home/placement (case worker). Foster parent can view it. */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'goals:manage');
    mutationGuard('agency-goal', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);
    const { childId, title, description, status, targetDate } = await readJson(req, agencyGoalSchema);

    if (childId) {
      const child = await prisma.childProfile.findFirst({ where: { id: childId, householdId: home.id }, select: { id: true } });
      if (!child) throw Errors.badRequest('That child is not in this home.');
    }

    const goal = await prisma.goal.create({
      data: { householdId: home.id, agencyId: ctx.agencyId, childId: childId ?? null, title, description: description ?? null, status, targetDate: targetDate ?? null, createdById: ctx.userId },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_GOAL_CREATED', metadata: { agencyId: ctx.agencyId, householdId: home.id, goalId: goal.id } });
    return json({ id: goal.id }, 201);
  });
}
