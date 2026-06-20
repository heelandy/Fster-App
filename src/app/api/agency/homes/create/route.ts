import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyCreateHomeSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Create a NEW foster home under the agency for a specific foster parent. The
 * foster parent must already have an account (their email) — a home always has a
 * foster parent owner, so a child can never be placed into a blank home. Case
 * workers and agency admins can create homes.
 */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:create');
    mutationGuard('agency-home-create', ctx.userId, RateLimits.write);
    const { homeName, fosterParentEmail } = await readJson(req, agencyCreateHomeSchema);

    const parent = await prisma.user.findUnique({ where: { email: fosterParentEmail }, select: { id: true } });
    if (!parent) throw Errors.badRequest('No foster parent with that email — they need to create an account first.');

    const home = await prisma.$transaction(async (tx) => {
      const h = await tx.household.create({ data: { name: homeName, ownerId: parent.id, agencyId: ctx.agencyId } });
      await tx.householdMember.create({ data: { householdId: h.id, userId: parent.id, role: 'FOSTER_PARENT', acceptedAt: new Date() } });
      await tx.subscription.create({ data: { householdId: h.id, tier: 'FREE', status: 'ACTIVE' } });
      return h;
    });

    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_HOME_CREATED', metadata: { agencyId: ctx.agencyId, householdId: home.id, fosterParentEmail } });
    return json({ id: home.id, name: home.name }, 201);
  });
}
