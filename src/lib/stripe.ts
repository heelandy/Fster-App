import Stripe from 'stripe';
import { env, stripeConfigured } from './env';

/**
 * Stripe client. Constructed lazily so the app can boot and run in environments
 * where Stripe is not configured (billing UI degrades gracefully instead of
 * crashing). Raw card data never touches this server — all card entry happens on
 * Stripe-hosted Checkout / Customer Portal pages.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeConfigured) {
    throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY).');
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
      typescript: true,
      appInfo: { name: 'Foster Care Home Management System' },
    });
  }
  return client;
}

export { stripeConfigured };
