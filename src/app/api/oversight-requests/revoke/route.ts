import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Foster parent (home owner) removes their current agency's oversight. Clears
 * Household.agencyId so the agency immediately stops seeing the home (all oversight
 * queries are agencyId-scoped), and marks the approved request DENIED so it no
 * longer counts as active. The agency can request again later.
 */
export function POST() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'household:manage');
    mutationGuard('oversight-revoke', ctx.userId, RateLimits.write);

    const home = await prisma.household.findUnique({ where: { id: ctx.householdId }, select: { agencyId: true } });
    if (!home?.agencyId) throw Errors.badRequest('Your home is not overseen by an agency.');
    const agencyId = home.agencyId;

    await prisma.$transaction([
      prisma.household.update({ where: { id: ctx.householdId }, data: { agencyId: null } }),
      prisma.agencyOversightRequest.updateMany({
        where: { householdId: ctx.householdId, agencyId, status: 'APPROVED' },
        data: { status: 'DENIED', respondedAt: new Date() },
      }),
    ]);

    await logSecurity({ actorId: ctx.userId, event: 'OVERSIGHT_REVOKED', metadata: { householdId: ctx.householdId, agencyId } });
    return json({ ok: true });
  });
}
