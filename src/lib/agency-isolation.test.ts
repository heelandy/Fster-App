import { describe, it, expect, vi, beforeEach } from 'vitest';

// Thin prisma mock: requireAgencyHome only touches household.findFirst. The mock lets
// us assert the WHERE clause is scoped to the caller's agency — the real cross-tenant
// boundary — without a database.
const findFirst = vi.fn();
vi.mock('./prisma', () => ({ prisma: { household: { findFirst: (...args: unknown[]) => findFirst(...args) } } }));

import { agencyCan, requireAgencyHome, type AgencyContext } from './agency';

const ctxA: AgencyContext = { userId: 'uA', agencyId: 'agencyA', agencyName: 'Agency A', role: 'AGENCY_ADMIN' };

describe('agency abilities are scoped per role (tenant cannot exceed its grants)', () => {
  it('agency admin manages staff and can override placements', () => {
    expect(agencyCan('AGENCY_ADMIN', 'staff:manage')).toBe(true);
    expect(agencyCan('AGENCY_ADMIN', 'placements:override')).toBe(true);
  });
  it('case worker cannot manage staff or override placements', () => {
    expect(agencyCan('CASE_WORKER', 'staff:manage')).toBe(false);
    expect(agencyCan('CASE_WORKER', 'placements:override')).toBe(false);
  });
  it('viewer is read-only', () => {
    expect(agencyCan('AGENCY_VIEWER', 'homes:view')).toBe(true);
    expect(agencyCan('AGENCY_VIEWER', 'placements:manage')).toBe(false);
    expect(agencyCan('AGENCY_VIEWER', 'visits:manage')).toBe(false);
  });
});

describe('requireAgencyHome enforces cross-tenant isolation', () => {
  beforeEach(() => findFirst.mockReset());

  it('only ever queries homes owned by the caller agency', async () => {
    findFirst.mockResolvedValue({ id: 'homeA', name: 'A home', ownerId: 'oA', fosterStatus: 'APPROVED' });
    await requireAgencyHome(ctxA, 'homeA');
    expect(findFirst).toHaveBeenCalledTimes(1);
    const arg = findFirst.mock.calls[0][0] as { where: { id: string; agencyId: string } };
    // The lookup is filtered by BOTH the home id and the caller's agency — agency A
    // can never resolve a home unless it belongs to agency A.
    expect(arg.where.id).toBe('homeA');
    expect(arg.where.agencyId).toBe('agencyA');
  });

  it('rejects another agency\'s home (the scoped query returns nothing)', async () => {
    findFirst.mockResolvedValue(null); // homeB is not linked to agencyA, so the where matches nothing
    await expect(requireAgencyHome(ctxA, 'homeB')).rejects.toBeTruthy();
  });
});
