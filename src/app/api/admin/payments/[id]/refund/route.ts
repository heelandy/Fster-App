import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';
import { getStripe } from '@/lib/stripe';
import { adminRefundSchema } from '@/lib/validation';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Refund a payment via Stripe. `Payment.stripePaymentId` holds the Stripe invoice
 * id, so we resolve its payment_intent/charge before issuing the refund. Gated by
 * `payments.refund` (FINANCE_ADMIN / SUPER_ADMIN). Card data never touches us.
 */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const admin = await requireAdminPermission('payments.refund');
    mutationGuard('admin-finance', admin.id, RateLimits.write);
    const body = await readJson(req, adminRefundSchema);

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, amountCents: true, stripePaymentId: true },
    });
    if (!payment) throw Errors.notFound();
    if (payment.status === 'refunded') throw Errors.badRequest('This payment is already refunded.');
    if (!payment.stripePaymentId) throw Errors.badRequest('This payment has no Stripe reference to refund.');
    if (body.amountCents && body.amountCents > payment.amountCents) {
      throw Errors.badRequest('Refund amount exceeds the payment.');
    }

    const stripe = await getStripe();
    const invoice = await stripe.invoices.retrieve(payment.stripePaymentId);
    const pi = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id;
    const charge = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id;
    if (!pi && !charge) throw Errors.badRequest('No charge found for this invoice to refund.');

    const refundParams: Stripe.RefundCreateParams = pi ? { payment_intent: pi } : { charge: charge! };
    if (body.amountCents) refundParams.amount = body.amountCents;
    if (body.reason) refundParams.reason = body.reason;
    const refund = await stripe.refunds.create(refundParams);

    const fullRefund = !body.amountCents || body.amountCents === payment.amountCents;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: fullRefund ? 'refunded' : 'partially_refunded' },
    });
    await logAdmin({
      actorId: admin.id,
      action: 'PAYMENT_REFUND',
      targetType: 'Payment',
      targetId: payment.id,
      metadata: {
        amountCents: body.amountCents ?? payment.amountCents,
        full: fullRefund,
        refundId: refund.id,
        reason: body.reason ?? null,
      },
    });
    return json({ ok: true, refundId: refund.id });
  });
}
