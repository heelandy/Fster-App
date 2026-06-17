import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { getStripeWebhookSecret } from '@/lib/config';
import { syncSubscription, markCanceled, recordInvoice } from '@/lib/billing-sync';
import { logSecurity } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notify';

export const runtime = 'nodejs';
// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const webhookSecret = await getStripeWebhookSecret();
  if (!(await isStripeConfigured()) || !webhookSecret) {
    return new Response('Stripe not configured', { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const stripe = await getStripe();
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch {
    // Signature verification failed — reject spoofed/replayed events.
    await logSecurity({ event: 'WEBHOOK_SIGNATURE_INVALID', path: '/api/stripe/webhook' });
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency: record the event id first. A duplicate (Stripe retry or replay)
  // hits the unique constraint and is acknowledged without re-processing.
  try {
    await prisma.processedWebhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // DB unavailable — let Stripe retry rather than silently dropping the event.
    console.error('[stripe webhook] idempotency write failed:', err);
    return new Response('Idempotency error', { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          // Payment Link path: the subscription has no householdId metadata (we
          // didn't create it via the Checkout API). Attribute it from the link's
          // client_reference_id = "<householdId>__<tier>": map the customer to the
          // household and stamp metadata so later subscription.* events resolve too.
          const ref = session.client_reference_id;
          if (ref && ref.includes('__') && !sub.metadata?.householdId) {
            const [householdId, tier] = ref.split('__');
            const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
            try {
              await prisma.household.update({ where: { id: householdId }, data: { stripeCustomerId: customerId } });
              const updated = await stripe.subscriptions.update(sub.id, {
                metadata: { ...sub.metadata, householdId, tier },
              });
              sub.metadata = updated.metadata;
            } catch (e) {
              console.error('[stripe webhook] payment-link attribution failed:', e);
            }
          }
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await markCanceled(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await recordInvoice(event.data.object as Stripe.Invoice, true);
        break;
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await recordInvoice(invoice, false);
        await notifyAdmins({
          type: 'PAYMENT_FAILED',
          message: `Payment failed for customer ${typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? 'unknown'} ($${(invoice.amount_due / 100).toFixed(2)})`,
          level: 'warning',
          metadata: { invoiceId: invoice.id },
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    // Return 500 so Stripe retries delivery.
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
