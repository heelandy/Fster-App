import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { incidentCreateSchema } from '@/lib/validation';
import { assertChildInHousehold } from '@/lib/scope';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/** List incidents reported for the caller's household. */
export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'incidents:read');
    const incidents = await prisma.incident.findMany({
      where: { householdId: ctx.householdId },
      select: { id: true, title: true, description: true, severity: true, status: true, resolution: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return json(incidents);
  });
}

/** Foster parent reports an incident about a placement. Routed to the agency if linked. */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'incidents:write');
    mutationGuard('incidents', ctx.userId, RateLimits.write);
    const { title, description, severity, childId } = await readJson(req, incidentCreateSchema);
    if (childId) await assertChildInHousehold(ctx, childId);

    const home = await prisma.household.findUnique({ where: { id: ctx.householdId }, select: { agencyId: true } });
    const incident = await prisma.incident.create({
      data: {
        householdId: ctx.householdId,
        childId: childId ?? null,
        agencyId: home?.agencyId ?? null,
        reportedById: ctx.userId,
        title,
        description: description ?? null,
        severity,
        status: 'REPORTED',
      },
      select: { id: true, title: true, severity: true, status: true, createdAt: true },
    });
    await logSecurity({ actorId: ctx.userId, event: 'INCIDENT_REPORTED', metadata: { householdId: ctx.householdId, incidentId: incident.id, severity } });
    return json(incident, 201);
  });
}
