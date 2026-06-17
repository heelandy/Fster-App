import type Stripe from 'stripe';
import type { PlanTier, SubscriptionStatus, BillingInterval } from '@prisma/client';
import { prisma } from './prisma';
import { PLANS } from './plans';
import { getStripe, isStripeConfigured } from './stripe';
import { getStripePriceId } from './config';

const GRACE_DAYS = 7;

/** Map a Stripe subscription status to our internal status (with grace period). */
function mapStatus(s: Stripe.Subscription.Status): { status: SubscriptionStatus; graceUntil: Date | null } {
  switch (s) {
    case 'active':
      return { status: 'ACTIVE', graceUntil: null };
    case 'trialing':
      return { status: 'TRIALING', graceUntil: null };
    case 'past_due':
      // Keep access during a grace window before downgrading.
      return { status: 'GRACE', graceUntil: new Date(Date.now() + GRACE_DAYS * 86_400_000) };
    case 'unpaid':
      return { status: 'UNPAID', graceUntil: null };
    case 'canceled':
      return { status: 'CANCELED', graceUntil: null };
    default:
      return { status: 'INCOMPLETE', graceUntil: null };
  }
}

/** Resolve the plan tier from subscription metadata, falling back to the price id. */
function resolveTier(sub: Stripe.Subscription): PlanTier {
  const metaTier = sub.metadata?.tier as PlanTier | undefined;
  if (metaTier && PLANS[metaTier]) return metaTier;
  const priceId = sub.items.data[0]?.price.id;
  for (const plan of Object.values(PLANS)) {
    if (priceId && (priceId === plan.stripePriceMonthly || priceId === plan.stripePriceAnnual)) {
      return plan.tier;
    }
  }
  return 'FREE';
}

/** Upsert our Subscription record from a Stripe subscription object. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const householdId = sub.metadata?.householdId;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const household = householdId
    ? await prisma.household.findUnique({ where: { id: householdId }, select: { id: true } })
    : await prisma.household.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  if (!household) return;

  const { status, graceUntil } = mapStatus(sub.status);
  const tier = resolveTier(sub);
  const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'ANNUAL' : 'MONTHLY';

  await prisma.subscription.upsert({
    where: { householdId: household.id },
    update: {
      tier,
      status,
      interval,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      graceUntil,
    },
    create: {
      householdId: household.id,
      tier,
      status,
      interval,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      graceUntil,
    },
  });
}

/** Mark a subscription canceled (access drops to FREE via effectiveTier). */
export async function markCanceled(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: 'CANCELED', tier: 'FREE', graceUntil: null },
  });
  // Defensive: also clear by customer if subscription id wasn't stored yet.
  await prisma.subscription.updateMany({
    where: { stripeCustomerId: customerId, stripeSubscriptionId: null },
    data: { status: 'CANCELED', tier: 'FREE' },
  });
}

/** Record an invoice + payment, used for the invoices/receipts list. */
export async function recordInvoice(invoice: Stripe.Invoice, paid: boolean) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!subscription) return;

  if (invoice.id) {
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      update: {
        amountDueCents: invoice.amount_due,
        amountPaidCents: invoice.amount_paid,
        status: invoice.status ?? (paid ? 'paid' : 'open'),
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
      create: {
        subscriptionId: subscription.id,
        stripeInvoiceId: invoice.id,
        amountDueCents: invoice.amount_due,
        amountPaidCents: invoice.amount_paid,
        status: invoice.status ?? (paid ? 'paid' : 'open'),
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      },
    });
  }

  if (paid && invoice.id) {
    await prisma.payment.upsert({
      where: { stripePaymentId: invoice.id },
      update: { status: 'succeeded', amountCents: invoice.amount_paid },
      create: {
        subscriptionId: subscription.id,
        stripePaymentId: invoice.id,
        amountCents: invoice.amount_paid,
        currency: invoice.currency ?? 'usd',
        status: 'succeeded',
      },
    });
    // A successful payment restores access if we were in grace/past_due.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { graceUntil: null },
    });
  }
}

/** Resolve a plan tier from a Stripe price id, checking env PLANS then DB config. */
async function tierFromPriceId(priceId: string): Promise<PlanTier | null> {
  for (const plan of Object.values(PLANS)) {
    if (priceId === plan.stripePriceMonthly || priceId === plan.stripePriceAnnual) return plan.tier;
  }
  const tiers: PlanTier[] = ['FAMILY', 'PRO', 'AGENCY'];
  const intervals: BillingInterval[] = ['MONTHLY', 'ANNUAL'];
  for (const t of tiers) {
    for (const i of intervals) {
      if ((await getStripePriceId(t, i)) === priceId) return t;
    }
  }
  return null;
}

/**
 * Pull the household's current subscription state directly from Stripe and sync it,
 * WITHOUT relying on a webhook. Used on the post-checkout return and a manual
 * "refresh" — so a plan upgrade applies even if webhooks aren't configured (local
 * dev) or an event was missed. Resolves the Stripe customer by the stored id, or
 * (for Payment-Link purchases that never created one locally) by the owner's email.
 */
export async function reconcileFromStripe(householdId: string): Promise<void> {
  if (!(await isStripeConfigured())) return;
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { id: true, stripeCustomerId: true, owner: { select: { email: true } } },
  });
  if (!household) return;

  const stripe = await getStripe();

  // Gather candidate customers: the one we already stored PLUS every Stripe
  // customer with the owner's email. Payment Links create a fresh customer per
  // purchase, so the active subscription often lives on a different customer than
  // the one on file — we must look across all of them.
  const customerIds = new Set<string>();
  if (household.stripeCustomerId) customerIds.add(household.stripeCustomerId);
  if (household.owner?.email) {
    const matches = await stripe.customers.list({ email: household.owner.email, limit: 20 });
    for (const c of matches.data) customerIds.add(c.id);
  }
  if (customerIds.size === 0) return;

  const allSubs: Stripe.Subscription[] = [];
  for (const cid of customerIds) {
    const list = await stripe.subscriptions.list({ customer: cid, status: 'all', limit: 10 });
    allSubs.push(...list.data);
  }
  if (allSubs.length === 0) return;

  // Most recent entitling subscription wins (active/trialing/past_due), else the
  // most recent of any status.
  const ranked = allSubs.sort((a, b) => b.created - a.created);
  const sub = ranked.find((s) => ['active', 'trialing', 'past_due'].includes(s.status)) ?? ranked[0];
  const subCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Point the household at the customer that actually holds the subscription (so
  // "Manage billing" and future reconciles use the right one).
  if (household.stripeCustomerId !== subCustomerId) {
    try {
      await prisma.household.update({ where: { id: household.id }, data: { stripeCustomerId: subCustomerId } });
    } catch {
      /* unique-constraint race / already linked elsewhere — metadata below still attributes it */
    }
  }

  // Payment-Link subscriptions carry no householdId/tier metadata — stamp them so
  // this and future events attribute correctly (syncSubscription reads metadata).
  if (!sub.metadata?.householdId || !sub.metadata?.tier) {
    const priceId = sub.items.data[0]?.price.id;
    const tier = priceId ? await tierFromPriceId(priceId) : null;
    const updated = await stripe.subscriptions.update(sub.id, {
      metadata: { ...sub.metadata, householdId, ...(tier ? { tier } : {}) },
    });
    sub.metadata = updated.metadata;
  }

  await syncSubscription(sub);
}
