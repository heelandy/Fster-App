import type { PlanTier } from '@prisma/client';
import { env } from './env';

/**
 * Source of truth for subscription plans and feature gating.
 * The database `Plan` table mirrors this (seeded), but gating logic always
 * resolves against this map so access control cannot be tampered with via data.
 */

export type FeatureKey =
  | 'documents'
  | 'careLogs'
  | 'medications'
  | 'expenses'
  | 'licensingTracker'
  | 'exports'
  | 'advancedReminders'
  | 'coParentAccess'
  | 'babysitterMode'
  | 'agencyDashboard'
  | 'multiHome';

export interface PlanFeatures {
  tier: PlanTier;
  name: string;
  description: string;
  priceCentsMonthly: number;
  priceCentsAnnual: number;
  stripePriceMonthly: string;
  stripePriceAnnual: string;
  limits: {
    maxChildren: number; // -1 = unlimited
    maxHouseholds: number;
    maxAppointments: number;
    maxChecklists: number;
  };
  features: Record<FeatureKey, boolean>;
}

const ALL_OFF: Record<FeatureKey, boolean> = {
  documents: false,
  careLogs: false,
  medications: false,
  expenses: false,
  licensingTracker: false,
  exports: false,
  advancedReminders: false,
  coParentAccess: false,
  babysitterMode: false,
  agencyDashboard: false,
  multiHome: false,
};

export const PLANS: Record<PlanTier, PlanFeatures> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    description: 'One household, one child profile, limited checklists & appointments.',
    priceCentsMonthly: 0,
    priceCentsAnnual: 0,
    stripePriceMonthly: '',
    stripePriceAnnual: '',
    limits: { maxChildren: 1, maxHouseholds: 1, maxAppointments: 10, maxChecklists: 2 },
    features: { ...ALL_OFF },
  },
  FAMILY: {
    tier: 'FAMILY',
    name: 'Family',
    description: 'Multiple children, care logs, medications, expenses, basic documents.',
    priceCentsMonthly: 999,
    priceCentsAnnual: 9990,
    stripePriceMonthly: env.STRIPE_PRICE_FAMILY_MONTHLY,
    stripePriceAnnual: env.STRIPE_PRICE_FAMILY_ANNUAL,
    limits: { maxChildren: 5, maxHouseholds: 1, maxAppointments: -1, maxChecklists: -1 },
    features: {
      ...ALL_OFF,
      documents: true,
      careLogs: true,
      medications: true,
      expenses: true,
    },
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro Foster Parent',
    description:
      'Unlimited children, full document storage, licensing tracker, exports, co-parent & babysitter access.',
    priceCentsMonthly: 1999,
    priceCentsAnnual: 19990,
    stripePriceMonthly: env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceAnnual: env.STRIPE_PRICE_PRO_ANNUAL,
    limits: { maxChildren: -1, maxHouseholds: 1, maxAppointments: -1, maxChecklists: -1 },
    features: {
      ...ALL_OFF,
      documents: true,
      careLogs: true,
      medications: true,
      expenses: true,
      licensingTracker: true,
      exports: true,
      advancedReminders: true,
      coParentAccess: true,
      babysitterMode: true,
    },
  },
  AGENCY: {
    tier: 'AGENCY',
    name: 'Agency / Multi-Home',
    description:
      'Everything in Pro plus multiple foster homes, agency dashboard, household-level permissions, and compliance overview.',
    priceCentsMonthly: 4999,
    priceCentsAnnual: 49990,
    stripePriceMonthly: env.STRIPE_PRICE_AGENCY_MONTHLY,
    stripePriceAnnual: env.STRIPE_PRICE_AGENCY_ANNUAL,
    limits: { maxChildren: -1, maxHouseholds: -1, maxAppointments: -1, maxChecklists: -1 },
    features: {
      ...ALL_OFF,
      documents: true,
      careLogs: true,
      medications: true,
      expenses: true,
      licensingTracker: true,
      exports: true,
      advancedReminders: true,
      coParentAccess: true,
      babysitterMode: true,
      agencyDashboard: true,
      multiHome: true,
    },
  },
};

export function planFor(tier: PlanTier): PlanFeatures {
  return PLANS[tier];
}

export function planHasFeature(tier: PlanTier, feature: FeatureKey): boolean {
  return PLANS[tier].features[feature] === true;
}

export function planLimit(tier: PlanTier, limit: keyof PlanFeatures['limits']): number {
  return PLANS[tier].limits[limit];
}

/** -1 means unlimited. */
export function withinLimit(tier: PlanTier, limit: keyof PlanFeatures['limits'], current: number): boolean {
  const max = planLimit(tier, limit);
  return max === -1 || current < max;
}

export const PAID_TIERS: PlanTier[] = ['FAMILY', 'PRO', 'AGENCY'];
