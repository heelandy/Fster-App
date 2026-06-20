import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';
import { adminGrantPlanSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * Manually grant / override a household's plan — for comped, grant-funded,
 * scholarship or government-funded accounts. Resolved by the owner's email and
 * applied to their primary (oldest) owned household. A paid tier is marked
 * `comped` so the Stripe reconcile leaves it alone; granting FREE clears the
 * comp and returns control to Stripe. Gated by `payments.refund`.
 */
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('payments.refund');
    mutationGuard('admin-grant', admin.id, RateLimits.write);
    const { email, tier, note } = await readJson(req, adminGrantPlanSchema);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw Errors.badRequest('No user with that email.');
    const home = await prisma.household.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (!home) throw Errors.badRequest('That user does not own a household.');

    const comped = tier !== 'FREE';
    await prisma.subscription.upsert({
      where: { householdId: home.id },
      update: { tier, status: 'ACTIVE', comped, compNote: note ?? null, cancelAtPeriodEnd: false, graceUntil: null },
      create: { householdId: home.id, tier, status: 'ACTIVE', comped, compNote: note ?? null },
    });

    await logAdmin({
      actorId: admin.id,
      action: 'PLAN_GRANT',
      targetType: 'Household',
      targetId: home.id,
      metadata: { email, tier, comped, note: note ?? null },
    });
    return json({ ok: true, household: home.name, tier, comped });
  });
}
