import type { PlanTier, BillingInterval } from '@prisma/client';
import { getStripe } from './stripe';
import { getStripePriceId, setStripePriceId } from './config';

/**
 * Change the LIVE Stripe price for a plan tier/interval. Stripe Prices are immutable,
 * so "changing a price" means creating a NEW Price on the same Product, repointing the
 * stored Price ID (so new checkouts use it), and archiving the old Price. Existing
 * subscriptions are deliberately left on their current Price — customers are
 * grandfathered, never silently re-billed at a new amount.
 *
 * Makes real, outward-facing writes to Stripe; only call behind an explicit opt-in.
 */
export interface PriceSyncResult {
  interval: BillingInterval;
  priceId: string;
  archivedOld: string | null;
}

export async function syncStripePrice(
  tier: PlanTier,
  interval: BillingInterval,
  unitAmountCents: number,
  by?: string,
): Promise<PriceSyncResult> {
  const stripe = await getStripe(); // throws if Stripe is not configured
  const oldId = await getStripePriceId(tier, interval);

  // Reuse the existing Price's Product so we don't spawn a duplicate Product. If
  // there's no usable old Price, create a Product named for the tier/interval.
  let productId: string | undefined;
  if (oldId) {
    try {
      const old = await stripe.prices.retrieve(oldId);
      if (typeof old.product === 'string') productId = old.product;
      else if (old.product && !('deleted' in old.product && old.product.deleted)) productId = old.product.id;
    } catch {
      productId = undefined; // old price missing/invalid — fall through to a fresh Product
    }
  }

  const created = await stripe.prices.create({
    currency: 'usd',
    unit_amount: unitAmountCents,
    recurring: { interval: interval === 'ANNUAL' ? 'year' : 'month' },
    ...(productId ? { product: productId } : { product_data: { name: `${tier} (${interval})` } }),
  });

  await setStripePriceId(tier, interval, created.id, by);

  // Archive the old Price so it's no longer offered for NEW checkouts. Existing
  // subscriptions on it keep billing unchanged.
  let archivedOld: string | null = null;
  if (oldId && oldId !== created.id) {
    try {
      await stripe.prices.update(oldId, { active: false });
      archivedOld = oldId;
    } catch {
      /* best-effort: a stale/missing old price shouldn't fail the change */
    }
  }

  return { interval, priceId: created.id, archivedOld };
}
