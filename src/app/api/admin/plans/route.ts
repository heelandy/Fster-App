import type { PlanTier, BillingInterval } from '@prisma/client';
import { requireAdminPermission } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { adminCan } from '@/lib/admin';
import { PLANS } from '@/lib/plans';
import { resolvePlanCatalogue } from '@/lib/plan-catalogue';
import { getStripePriceId } from '@/lib/config';
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
 */
export function PATCH(req: Request) {
  return handle(async () => {
    const admin = await requireAdminPermission('plans.manage');
    mutationGuard('admin-plans', admin.id, RateLimits.write);
    const { tier, ...changes } = await readJson(req, adminPlanUpdateSchema);
    const code = PLANS[tier as PlanTier];

    await prisma.plan.upsert({
      where: { tier: tier as PlanTier },
      update: changes,
      create: {
        tier: tier as PlanTier,
        name: changes.name ?? code.name,
        description: changes.description ?? code.description,
        priceCentsMonthly: changes.priceCentsMonthly ?? code.priceCentsMonthly,
        priceCentsAnnual: changes.priceCentsAnnual ?? code.priceCentsAnnual,
        isActive: changes.isActive ?? true,
      },
    });
    await logAdmin({ actorId: admin.id, action: 'PLAN_UPDATED', targetType: 'Plan', targetId: tier, metadata: changes });
    return json({ ok: true });
  });
}
