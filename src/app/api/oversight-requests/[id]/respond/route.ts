import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { oversightRespondSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Foster parent (home owner) approves or denies an agency's request to oversee
 * their home. Approve links the home (sets Household.agencyId so the agency can see
 * it); deny leaves it untouched. Only a PENDING request for the caller's OWN
 * household can be answered, and only once.
 */
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'household:manage');
    mutationGuard('oversight-respond', ctx.userId, RateLimits.write);
    const { decision } = await readJson(req, oversightRespondSchema);

    const request = await prisma.agencyOversightRequest.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, agencyId: true, householdId: true },
    });
    if (!request || request.householdId !== ctx.householdId) throw Errors.notFound();
    if (request.status !== 'PENDING') throw Errors.badRequest('This request has already been answered.');

    const now = new Date();
    if (decision === 'APPROVED') {
      // Never override a home already linked to another agency.
      const home = await prisma.household.findUnique({ where: { id: request.householdId }, select: { agencyId: true } });
      if (home?.agencyId && home.agencyId !== request.agencyId) {
        throw Errors.conflict('Your home is already overseen by another agency.');
      }
      await prisma.$transaction([
        prisma.household.update({ where: { id: request.householdId }, data: { agencyId: request.agencyId } }),
        prisma.agencyOversightRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', respondedAt: now } }),
      ]);
    } else {
      await prisma.agencyOversightRequest.update({ where: { id: request.id }, data: { status: 'DENIED', respondedAt: now } });
    }

    await logSecurity({
      actorId: ctx.userId,
      event: 'OVERSIGHT_RESPONSE',
      metadata: { householdId: ctx.householdId, requestId: request.id, agencyId: request.agencyId, decision },
    });
    return json({ ok: true, decision });
  });
}
