import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyVisitSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Record a case-worker visit to one of the agency's homes (home visit, court,
 * school meeting…). Logged by agency staff; the foster parent sees it too.
 */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'visits:manage');
    mutationGuard('agency-visit', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);
    const { visitDate, visitType, summary } = await readJson(req, agencyVisitSchema);

    const visit = await prisma.visit.create({
      data: {
        householdId: home.id,
        agencyId: ctx.agencyId,
        visitDate,
        visitType: visitType ?? null,
        summary: summary ?? null,
        createdById: ctx.userId,
      },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_VISIT_RECORDED', metadata: { agencyId: ctx.agencyId, householdId: home.id, visitId: visit.id } });
    return json({ id: visit.id }, 201);
  });
}
