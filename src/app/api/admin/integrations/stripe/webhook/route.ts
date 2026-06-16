import { requireAdminPermission } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { requireStepUp } from '@/lib/stepup';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import {
  CONFIG_KEYS, setStripeWebhookSecret, setStripeWebhookEndpointId,
} from '@/lib/config';
import { getSettingValue } from '@/lib/settings';
import { logAdmin } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The Stripe events our webhook handler processes (src/app/api/stripe/webhook).
const ENABLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

/**
 * Register (or re-register) the Stripe webhook endpoint for this deployment via
 * the Stripe API, and store the returned signing secret — so going live needs no
 * code/env edits. Requires the Stripe secret key to be configured first.
 */
export function POST() {
  return handle(async () => {
    const admin = await requireAdminPermission('admins.manage');
    mutationGuard('integrations-webhook', admin.id, RateLimits.write);
    requireStepUp(admin.id);

    if (!(await isStripeConfigured())) {
      throw Errors.badRequest('Set a valid Stripe secret key first, then create the webhook.');
    }

    const stripe = await getStripe();
    const url = `${env.APP_URL}/api/stripe/webhook`;

    // Remove a previously-created endpoint (best-effort) to avoid duplicates.
    const existingId = await getSettingValue(CONFIG_KEYS.stripeWebhookEndpointId);
    if (existingId) {
      try {
        await stripe.webhookEndpoints.del(existingId);
      } catch {
        // already gone / different account — ignore
      }
    }

    const endpoint = await stripe.webhookEndpoints.create({
      url,
      enabled_events: [...ENABLED_EVENTS],
      description: 'Foster Care HMS (created from admin Integrations)',
    });

    // endpoint.secret (whsec_…) is only returned on create — persist it now.
    if (!endpoint.secret) throw Errors.badRequest('Stripe did not return a signing secret. Try again.');
    await setStripeWebhookSecret(endpoint.secret, admin.id);
    await setStripeWebhookEndpointId(endpoint.id, admin.id);

    await logAdmin({
      actorId: admin.id,
      action: 'STRIPE_WEBHOOK_CREATED',
      targetType: 'StripeWebhookEndpoint',
      targetId: endpoint.id,
      metadata: { url, events: ENABLED_EVENTS.length },
    });

    return json({ ok: true, endpointId: endpoint.id, url, livemode: endpoint.livemode });
  });
}
