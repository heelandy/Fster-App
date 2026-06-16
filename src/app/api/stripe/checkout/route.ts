import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { checkoutSchema } from '@/lib/validation';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { getStripePriceId } from '@/lib/config';
import { env } from '@/lib/env';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'billing:manage');
    mutationGuard('checkout', ctx.userId, RateLimits.write);

    if (!(await isStripeConfigured())) throw Errors.payment('Billing is not configured on this server.');

    const { tier, interval, promoCode } = await readJson(req, checkoutSchema);
    const priceId = await getStripePriceId(tier, interval ?? 'MONTHLY');
    if (!priceId) throw Errors.payment('That plan is not available for purchase yet.');

    const stripe = await getStripe();
    const household = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      include: { owner: { select: { email: true } }, subscription: true },
    });
    if (!household) throw Errors.notFound();

    // Reuse or create the Stripe customer for this household.
    let customerId = household.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: household.owner.email,
        name: household.name,
        metadata: { householdId: household.id },
      });
      customerId = customer.id;
      await prisma.household.update({ where: { id: household.id }, data: { stripeCustomerId: customerId } });
    }

    // Stripe's discounts[].promotion_code expects a promotion-code ID (promo_…),
    // not the human-entered code. Resolve it; fail clearly if it's invalid.
    let discounts: { promotion_code: string }[] | undefined;
    if (promoCode) {
      const matches = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
      const pc = matches.data[0];
      if (!pc) throw Errors.badRequest('That promo code is not valid.');
      discounts = [{ promotion_code: pc.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe rejects allow_promotion_codes together with discounts.
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      subscription_data: { metadata: { householdId: household.id, tier } },
      success_url: `${env.APP_URL}/billing?status=success`,
      cancel_url: `${env.APP_URL}/billing?status=cancelled`,
      client_reference_id: household.id,
    });

    return json({ url: session.url });
  });
}
