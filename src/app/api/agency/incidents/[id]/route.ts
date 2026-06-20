import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { incidentUpdateSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Case worker reviews / escalates / resolves an incident in one of the agency's homes. */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'incidents:manage');
    mutationGuard('agency-incident', ctx.userId, RateLimits.write);
    const { status, resolution } = await readJson(req, incidentUpdateSchema);

    const incident = await prisma.incident.findUnique({
      where: { id: params.id },
      select: { id: true, household: { select: { agencyId: true } } },
    });
    if (!incident || incident.household.agencyId !== ctx.agencyId) throw Errors.notFound();

    await prisma.incident.update({
      where: { id: params.id },
      data: { status, ...(resolution !== undefined ? { resolution: resolution ?? null } : {}) },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_INCIDENT_UPDATED', metadata: { agencyId: ctx.agencyId, incidentId: params.id, status } });
    return json({ ok: true, status });
  });
}
