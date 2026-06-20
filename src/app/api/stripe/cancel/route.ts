import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * Cancel the household's plan IMMEDIATELY and drop to Free. Cancels the Stripe
 * subscription (if any) right away — no waiting for the period end — and also
 * works for a manually-set/seeded plan that has no Stripe subscription behind it.
 */
export function POST() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'billing:manage');
    mutationGuard('cancel', ctx.userId, RateLimits.write);

    const household = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      select: { subscription: { select: { id: true, stripeSubscriptionId: true } } },
    });

    const subId = household?.subscription?.stripeSubscriptionId;
    if (subId && (await isStripeConfigured())) {
      try {
        const stripe = await getStripe();
        await stripe.subscriptions.cancel(subId);
      } catch {
        // already canceled / not found — fall through to the local downgrade
      }
    }

    if (household?.subscription) {
      await prisma.subscription.update({
        where: { householdId: ctx.householdId },
        data: { tier: 'FREE', status: 'ACTIVE', stripeSubscriptionId: null, cancelAtPeriodEnd: false, graceUntil: null, comped: false },
      });
    }
    return json({ ok: true, tier: 'FREE' });
  });
}
