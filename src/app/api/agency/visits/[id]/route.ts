import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyVisitUpdateSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Mark a scheduled visit complete (or back to scheduled). Scoped to the agency. */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'visits:manage');
    mutationGuard('agency-visit-update', ctx.userId, RateLimits.write);
    const { status } = await readJson(req, agencyVisitUpdateSchema);

    const visit = await prisma.visit.findUnique({ where: { id: params.id }, select: { id: true, household: { select: { agencyId: true } } } });
    if (!visit || visit.household.agencyId !== ctx.agencyId) throw Errors.notFound();

    await prisma.visit.update({ where: { id: params.id }, data: { status } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_VISIT_UPDATED', metadata: { agencyId: ctx.agencyId, visitId: params.id, status } });
    return json({ ok: true, status });
  });
}
