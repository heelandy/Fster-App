import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { env } from '@/lib/env';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Opens the Stripe Customer Portal where users update payment methods, switch
// plans, view invoices, download receipts, cancel and resume subscriptions.
export function POST() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'billing:manage');
    mutationGuard('portal', ctx.userId, RateLimits.write);
    if (!(await isStripeConfigured())) throw Errors.payment('Billing is not configured on this server.');

    const household = await prisma.household.findUnique({
      where: { id: ctx.householdId },
      select: { stripeCustomerId: true },
    });
    if (!household?.stripeCustomerId) throw Errors.badRequest('No billing account yet. Choose a plan first.');

    const stripe = await getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: household.stripeCustomerId,
      // Reconcile on return so a cancellation / plan change made in the portal
      // reflects in the app immediately (no webhook needed).
      return_url: `${env.APP_URL}/billing?refresh=1`,
    });
    return json({ url: session.url });
  });
}
