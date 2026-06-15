import { describe, it, expect } from 'vitest';
import { planHasFeature, withinLimit, planLimit, PLANS } from './plans';

describe('plan feature gating', () => {
  it('FREE plan has no paid features', () => {
    expect(planHasFeature('FREE', 'documents')).toBe(false);
    expect(planHasFeature('FREE', 'careLogs')).toBe(false);
    expect(planHasFeature('FREE', 'medications')).toBe(false);
    expect(planHasFeature('FREE', 'expenses')).toBe(false);
    expect(planHasFeature('FREE', 'licensingTracker')).toBe(false);
  });

  it('FAMILY unlocks core tracking but not licensing/exports/co-parent', () => {
    expect(planHasFeature('FAMILY', 'documents')).toBe(true);
    expect(planHasFeature('FAMILY', 'careLogs')).toBe(true);
    expect(planHasFeature('FAMILY', 'licensingTracker')).toBe(false);
    expect(planHasFeature('FAMILY', 'coParentAccess')).toBe(false);
  });

  it('PRO unlocks licensing, exports, co-parent and babysitter mode', () => {
    expect(planHasFeature('PRO', 'licensingTracker')).toBe(true);
    expect(planHasFeature('PRO', 'exports')).toBe(true);
    expect(planHasFeature('PRO', 'coParentAccess')).toBe(true);
    expect(planHasFeature('PRO', 'babysitterMode')).toBe(true);
    expect(planHasFeature('PRO', 'agencyDashboard')).toBe(false);
  });

  it('AGENCY unlocks multi-home + agency dashboard', () => {
    expect(planHasFeature('AGENCY', 'agencyDashboard')).toBe(true);
    expect(planHasFeature('AGENCY', 'multiHome')).toBe(true);
  });
});

describe('plan limits', () => {
  it('FREE allows exactly one child', () => {
    expect(planLimit('FREE', 'maxChildren')).toBe(1);
    expect(withinLimit('FREE', 'maxChildren', 0)).toBe(true);
    expect(withinLimit('FREE', 'maxChildren', 1)).toBe(false);
  });

  it('PRO/AGENCY children are unlimited', () => {
    expect(withinLimit('PRO', 'maxChildren', 9999)).toBe(true);
    expect(withinLimit('AGENCY', 'maxChildren', 9999)).toBe(true);
  });

  it('AGENCY allows multiple households, others do not', () => {
    expect(withinLimit('AGENCY', 'maxHouseholds', 5)).toBe(true);
    expect(withinLimit('PRO', 'maxHouseholds', 1)).toBe(false);
  });

  it('every tier exists in the catalogue', () => {
    expect(Object.keys(PLANS).sort()).toEqual(['AGENCY', 'FAMILY', 'FREE', 'PRO']);
  });
});
