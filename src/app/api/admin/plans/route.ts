import type { PlanTier, BillingInterval } from '@prisma/client';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { adminCan } from '@/lib/admin';
import { PLANS } from '@/lib/plans';
import { resolvePlanCatalogue } from '@/lib/plan-catalogue';
import { getStripePriceId, isStripeConfigured } from '@/lib/config';
import { syncStripePrice } from '@/lib/stripe-plans';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { adminPlanUpdateSchema } from '@/lib/validation';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Plan catalogue for the admin Finance view. Commercial fields (name, description,
 * prices, isActive) come from the DB override when set (else code defaults); the
 * limits + feature gating ALWAYS come from code and are shown read-only — they are
 * the entitlement boundary and can't be edited via data. `canEdit` is true only for
 * SUPER_ADMIN (plans.manage). Stripe Price IDs are still set in the Integrations tab.
 */
export function GET() {
  return handle(async () => {
    const admin = await requireAdminPermission('payments.view');
    const canEdit = adminCan(admin.adminRole, 'plans.manage');
    const catalogue = await resolvePlanCatalogue();
    const rows = await Promise.all(
      catalogue.map(async (p) => {
        const paid = p.tier !== 'FREE';
        const [m, a] = paid
          ? await Promise.all([
              getStripePriceId(p.tier as PlanTier, 'MONTHLY' as BillingInterval),
              getStripePriceId(p.tier as PlanTier, 'ANNUAL' as BillingInterval),
            ])
          : ['', ''];
        return {
          tier: p.tier,
          name: p.name,
          description: p.description,
          isActive: p.isActive,
          priceCentsMonthly: p.priceCentsMonthly,
          priceCentsAnnual: p.priceCentsAnnual,
          limits: p.limits,
          features: Object.entries(p.features).filter(([, on]) => on).map(([k]) => k),
          stripeMonthlySet: !paid || m.length > 0,
          stripeAnnualSet: !paid || a.length > 0,
        };
      }),
    );
    return json({ canEdit, plans: rows });
  });
}

/**
 * SUPER_ADMIN edits a plan's commercial fields (name/description/prices/active),
 * persisted to the DB `Plan` table (an override over the code defaults). Feature
 * gating + limits are not editable here. Upserts so a missing row is created from
 * code defaults plus the provided changes.
 *
 * When `syncStripe` is set, a *changed* price is also pushed to Stripe — a new Stripe
 * Price is created and the stored Price ID repointed (existing subscribers keep their
 * current price). This is a real, outward-facing Stripe write, so it's opt-in only.
 */
export function PATCH(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('plans.manage');
    mutationGuard('admin-plans', admin.id, RateLimits.write);
    const { tier, syncStripe, ...changes } = await readJson(req, adminPlanUpdateSchema);
    const planTier = tier as PlanTier;
    const code = PLANS[planTier];

    // Effective prices BEFORE this edit, so we only push intervals that actually changed.
    const before = (await resolvePlanCatalogue()).find((p) => p.tier === tier);
    const prevMonthly = before?.priceCentsMonthly ?? code.priceCentsMonthly;
    const prevAnnual = before?.priceCentsAnnual ?? code.priceCentsAnnual;

    await prisma.plan.upsert({
      where: { tier: planTier },
      update: changes,
      create: {
        tier: planTier,
        name: changes.name ?? code.name,
        description: changes.description ?? code.description,
        priceCentsMonthly: changes.priceCentsMonthly ?? code.priceCentsMonthly,
        priceCentsAnnual: changes.priceCentsAnnual ?? code.priceCentsAnnual,
        isActive: changes.isActive ?? true,
      },
    });
    await logAdmin({ actorId: admin.id, action: 'PLAN_UPDATED', targetType: 'Plan', targetId: tier, metadata: changes });
    // Bust the cached landing-page plan catalogue so the edit shows immediately.
    revalidateTag('plans');

    // Optional Stripe price sync (real outward-facing writes). Reported back to the UI.
    let stripe: { ok: boolean; note: string } | null = null;
    if (syncStripe && tier !== 'FREE') {
      if (!(await isStripeConfigured())) {
        stripe = { ok: false, note: 'Stripe is not configured — the displayed price was saved, but no Stripe price was created.' };
      } else {
        const jobs: { interval: BillingInterval; cents: number }[] = [];
        if (changes.priceCentsMonthly !== undefined && changes.priceCentsMonthly !== prevMonthly && changes.priceCentsMonthly > 0) {
          jobs.push({ interval: 'MONTHLY', cents: changes.priceCentsMonthly });
        }
        if (changes.priceCentsAnnual !== undefined && changes.priceCentsAnnual !== prevAnnual && changes.priceCentsAnnual > 0) {
          jobs.push({ interval: 'ANNUAL', cents: changes.priceCentsAnnual });
        }
        if (jobs.length === 0) {
          stripe = { ok: true, note: 'No price change to push to Stripe.' };
        } else {
          try {
            const done: BillingInterval[] = [];
            for (const j of jobs) {
              const r = await syncStripePrice(planTier, j.interval, j.cents, admin.id);
              done.push(j.interval);
              await logAdmin({
                actorId: admin.id,
                action: 'PLAN_STRIPE_PRICE_SYNCED',
                targetType: 'Plan',
                targetId: tier,
                metadata: { interval: j.interval, priceId: r.priceId, archivedOld: r.archivedOld, unitAmountCents: j.cents },
              });
            }
            stripe = { ok: true, note: `Stripe price updated (${done.join(', ').toLowerCase()}). Existing subscribers keep their current price.` };
          } catch (e) {
            stripe = { ok: false, note: e instanceof Error ? e.message : 'Stripe price sync failed.' };
          }
        }
      }
    }

    return json({ ok: true, stripe });
  });
}
