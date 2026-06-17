import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';
import { getStripe } from '@/lib/stripe';
import { adminCreditSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * Apply an account credit to a household's Stripe customer. A negative balance
 * transaction reduces the amount due on their next invoice. Gated by
 * `payments.refund` (FINANCE_ADMIN / SUPER_ADMIN).
 */
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('payments.refund');
    mutationGuard('admin-finance', admin.id, RateLimits.write);
    const { householdId, amountCents, note } = await readJson(req, adminCreditSchema);

    const household = await prisma.household.findUnique({
      where: { id: householdId },
      select: { id: true, name: true, stripeCustomerId: true, subscription: { select: { stripeCustomerId: true } } },
    });
    if (!household) throw Errors.notFound();
    const customerId = household.stripeCustomerId ?? household.subscription?.stripeCustomerId;
    if (!customerId) throw Errors.badRequest('This household has no Stripe customer to credit.');

    const stripe = await getStripe();
    // Negative amount = credit applied against the customer's next invoice.
    const txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -amountCents,
      currency: 'usd',
      description: note || 'Account credit (admin)',
    });

    await logAdmin({
      actorId: admin.id,
      action: 'PAYMENT_CREDIT',
      targetType: 'Household',
      targetId: household.id,
      metadata: { amountCents, note: note ?? null, balanceTxnId: txn.id },
    });
    return json({ ok: true, balanceTxnId: txn.id });
  });
}
