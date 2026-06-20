import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyHomeStatusSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Approve / suspend a foster home (agency oversight record). This does NOT gate
 * the foster parent's own app access — it is the agency's approval/suspension
 * status for the home. Agency admin only.
 */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:manage');
    mutationGuard('agency-home-status', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);
    const { fosterStatus } = await readJson(req, agencyHomeStatusSchema);

    await prisma.household.update({ where: { id: home.id }, data: { fosterStatus } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_HOME_STATUS', metadata: { agencyId: ctx.agencyId, householdId: home.id, fosterStatus } });
    return json({ ok: true, fosterStatus });
  });
}
