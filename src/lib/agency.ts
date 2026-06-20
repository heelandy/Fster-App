import type { AgencyRole } from '@prisma/client';
import { prisma } from './prisma';
import { requireUser } from './authz';
import { Errors } from './http';

/**
 * Multi-agency access control. An agency is a tenant that oversees its OWN foster
 * homes; staff access is always scoped to that agency (never other agencies, and
 * never homes not linked to the agency). This is a separate access path from the
 * household-scoped app — it does not widen a foster parent's own boundaries.
 */

export type AgencyCapability =
  | 'agency:manage' // rename the agency
  | 'staff:manage' // add/remove staff, set roles
  | 'homes:manage' // link / unlink existing foster homes
  | 'homes:create' // create a new foster home for a foster parent
  | 'homes:view' // oversight: see homes, children, placements
  | 'placements:manage' // assign children, manage placement lifecycle, transfer
  | 'licensing:manage' // submit licensing/compliance items for a home
  | 'visits:manage' // record case-worker visits to a home
  | 'incidents:manage' // review/escalate/resolve incidents
  | 'announcements:manage' // broadcast announcements to homes
  | 'goals:manage' // set/track case goals for a placement
  | 'messages:manage' // message foster parents
  | 'placements:override' // force a placement status, bypassing accept/deny
  | 'children:view';

const MATRIX: Record<AgencyRole, AgencyCapability[]> = {
  AGENCY_ADMIN: ['agency:manage', 'staff:manage', 'homes:manage', 'homes:create', 'homes:view', 'placements:manage', 'placements:override', 'licensing:manage', 'visits:manage', 'incidents:manage', 'announcements:manage', 'goals:manage', 'messages:manage', 'children:view'],
  CASE_WORKER: ['homes:create', 'homes:view', 'placements:manage', 'licensing:manage', 'visits:manage', 'incidents:manage', 'goals:manage', 'messages:manage', 'children:view'],
  AGENCY_VIEWER: ['homes:view', 'children:view'],
};

export function agencyCan(role: AgencyRole, cap: AgencyCapability): boolean {
  return MATRIX[role].includes(cap);
}

export const AGENCY_ROLES: AgencyRole[] = ['AGENCY_ADMIN', 'CASE_WORKER', 'AGENCY_VIEWER'];

export interface AgencyContext {
  userId: string;
  agencyId: string;
  agencyName: string;
  role: AgencyRole;
}

/** The user's agency membership, or null (no throw) — for the portal landing. */
export async function findAgencyMembership(userId: string): Promise<AgencyContext | null> {
  const m = await prisma.agencyMember.findFirst({
    where: { userId },
    include: { agency: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return m ? { userId, agencyId: m.agencyId, agencyName: m.agency.name, role: m.role } : null;
}

/** Resolve the signed-in user's agency membership (403 if they're not staff). */
export async function requireAgencyMember(): Promise<AgencyContext> {
  const user = await requireUser();
  const ctx = await findAgencyMembership(user.id);
  if (!ctx) throw Errors.forbidden();
  return ctx;
}

export function requireAgencyCapability(ctx: AgencyContext, cap: AgencyCapability): void {
  if (!agencyCan(ctx.role, cap)) throw Errors.forbidden();
}

/** Verify a household is overseen by the caller's agency, returning it (else 403). */
export async function requireAgencyHome(ctx: AgencyContext, householdId: string) {
  const home = await prisma.household.findFirst({
    where: { id: householdId, agencyId: ctx.agencyId },
    select: { id: true, name: true, ownerId: true, fosterStatus: true },
  });
  if (!home) throw Errors.forbidden();
  return home;
}
