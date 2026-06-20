import type { PlanTier, BillingInterval } from '@prisma/client';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { PLANS } from '@/lib/plans';
import { getStripePriceId } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-only plan catalogue for the admin Finance view: the source-of-truth plans
 * (lib/plans.ts) plus whether each tier's Stripe Price IDs are configured. Prices
 * are edited in the Integrations tab; gating stays in code (can't be tampered via data).
 */
export function GET() {
  return handle(async () => {
    await requireAdminPermission('payments.view');
    const rows = await Promise.all(
      Object.values(PLANS).map(async (p) => {
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
          priceCentsMonthly: p.priceCentsMonthly,
          priceCentsAnnual: p.priceCentsAnnual,
          limits: p.limits,
          features: Object.entries(p.features).filter(([, on]) => on).map(([k]) => k),
          stripeMonthlySet: !paid || m.length > 0,
          stripeAnnualSet: !paid || a.length > 0,
        };
      }),
    );
    return json(rows);
  });
}
