import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, effectiveTier } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { reconcileFromStripe } from '@/lib/billing-sync';

export const runtime = 'nodejs';

/**
 * Pull the household's subscription state from Stripe and sync it — a webhook-free
 * way to apply a plan change right after checkout (and a safety net if a webhook is
 * missed). Returns the resulting effective tier so the client can detect an upgrade.
 */
export function POST() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'billing:manage');
    mutationGuard('stripe-sync', ctx.userId, RateLimits.write);

    await reconcileFromStripe(ctx.householdId);

    const sub = await prisma.subscription.findUnique({
      where: { householdId: ctx.householdId },
      select: { tier: true, status: true },
    });
    return json({ tier: effectiveTier(sub) });
  });
}
