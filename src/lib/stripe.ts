import Stripe from 'stripe';
import { getStripeSecretKey, isStripeConfigured } from './config';

/**
 * Stripe client. The secret key is resolved at call time from runtime config
 * (DB-first, env fallback) so a SuperAdmin can set live keys from the admin UI
 * without redeploying. The client is cached and rebuilt only if the key changes.
 * Raw card data never touches this server — all card entry happens on
 * Stripe-hosted Checkout / Customer Portal pages.
 */
let client: Stripe | null = null;
let clientKey = '';

export async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey();
  if (!key.startsWith('sk_')) {
    throw new Error('Stripe is not configured (missing secret key).');
  }
  if (!client || clientKey !== key) {
    client = new Stripe(key, {
      apiVersion: '2024-06-20',
      typescript: true,
      appInfo: { name: 'Foster Care Home Management System' },
    });
    clientKey = key;
  }
  return client;
}

export { isStripeConfigured };
