import type { PlanTier } from '@prisma/client';
import { prisma } from './prisma';
import { PLANS, type PlanFeatures } from './plans';

/**
 * Plan catalogue for DISPLAY. Code (lib/plans.ts) is the source of truth; the
 * admin-editable commercial fields (name, description, prices, isActive) are
 * overlaid from the DB `Plan` table when a row exists.
 *
 * Feature gating + limits ALWAYS come from code — they are the entitlement
 * boundary and are deliberately never editable through data/UI. So this module is
 * only used to render prices/names; `planHasFeature`/`planLimit` stay code-only.
 */
export interface PlanCatalogueEntry {
  tier: PlanTier;
  name: string;
  description: string;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  isActive: boolean;
  limits: PlanFeatures['limits'];
  features: PlanFeatures['features'];
}

export async function resolvePlanCatalogue(): Promise<PlanCatalogueEntry[]> {
  let overrides: { tier: PlanTier; name: string; description: string | null; priceCentsMonthly: number; priceCentsAnnual: number; isActive: boolean }[] = [];
  try {
    overrides = await prisma.plan.findMany({
      select: { tier: true, name: true, description: true, priceCentsMonthly: true, priceCentsAnnual: true, isActive: true },
    });
  } catch {
    // Plan table unavailable (e.g. not migrated) — fall back to pure code defaults.
    overrides = [];
  }
  const byTier = new Map(overrides.map((o) => [o.tier, o]));
  return Object.values(PLANS).map((p) => {
    const o = byTier.get(p.tier);
    return {
      tier: p.tier,
      name: o?.name || p.name,
      description: o?.description || p.description,
      priceCentsMonthly: o ? o.priceCentsMonthly : p.priceCentsMonthly,
      priceCentsAnnual: o ? o.priceCentsAnnual : p.priceCentsAnnual,
      isActive: o?.isActive ?? true,
      limits: p.limits,
      features: p.features,
    };
  });
}
