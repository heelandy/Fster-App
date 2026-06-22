import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { assertChildInHousehold } from '@/lib/scope';
import { householdVisitSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * A foster parent logs a visit to their own home (often unscheduled — e.g. a
 * caseworker or biological family member dropped by). "Who" and the reason are
 * required. The visit is stamped with the overseeing agency (if any) so it also
 * appears in agency oversight, mirroring agency-logged visits.
 */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:write');
    mutationGuard('visits', ctx.userId, RateLimits.write);

    const data = await readJson(req, householdVisitSchema);
    if (data.childId) await assertChildInHousehold(ctx, data.childId);

    const home = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      select: { agencyId: true },
    });

    // A future-dated visit is SCHEDULED; today or earlier is logged as COMPLETED.
    const status = data.visitDate.getTime() > Date.now() ? 'SCHEDULED' : 'COMPLETED';
    const visit = await prisma.visit.create({
      data: {
        householdId: ctx.householdId,
        agencyId: home?.agencyId ?? null,
        childId: data.childId ?? null,
        visitDate: data.visitDate,
        status,
        visitType: data.visitType ?? null,
        visitor: data.visitor,
        summary: data.summary,
        createdById: ctx.userId,
      },
    });
    await logSecurity({ actorId: ctx.userId, event: 'VISIT_LOGGED', metadata: { householdId: ctx.householdId, visitId: visit.id } });
    return json({ id: visit.id }, 201);
  });
}
