import { cookies } from 'next/headers';
import type { HouseholdRole, PlanTier, Subscription, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { auth } from './auth';
import { Errors } from './http';
import { planHasFeature, type FeatureKey } from './plans';
import { adminCan, type AdminPermission } from './admin';

/**
 * Authorization core — RBAC + household-scoped access control.
 *
 * Every data access goes through a household the user is a verified member of.
 * Resource IDs are ALWAYS combined with `householdId` in queries so a user can
 * never read or mutate another household's records (IDOR prevention).
 */

export const ACTIVE_HOUSEHOLD_COOKIE = 'fc_household';

export type Capability =
  | 'household:manage'
  | 'billing:manage'
  | 'members:manage'
  | 'children:read'
  | 'children:write'
  | 'appointments:read'
  | 'appointments:write'
  | 'documents:read'
  | 'documents:write'
  | 'careLogs:read'
  | 'careLogs:write'
  | 'medications:read'
  | 'medications:write'
  | 'expenses:read'
  | 'expenses:write'
  | 'contacts:read'
  | 'contacts:write'
  | 'legal:read'
  | 'routines:read'
  | 'routines:write'
  | 'licensing:read'
  | 'licensing:write'
  | 'incidents:read'
  | 'incidents:write'
  | 'behaviorLogs:read'
  | 'behaviorLogs:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'communications:read'
  | 'communications:write'
  | 'journal:read'
  | 'journal:write'
  | 'court:read'
  | 'court:write'
  | 'education:read'
  | 'education:write'
  | 'medical:read'
  | 'medical:write'
  | 'training:read'
  | 'training:write'
  | 'goals:read'
  | 'messages:read'
  | 'messages:write';

const FOSTER_PARENT_CAPS: Capability[] = [
  'household:manage',
  'billing:manage',
  'members:manage',
  'children:read',
  'children:write',
  'appointments:read',
  'appointments:write',
  'documents:read',
  'documents:write',
  'careLogs:read',
  'careLogs:write',
  'medications:read',
  'medications:write',
  'expenses:read',
  'expenses:write',
  'contacts:read',
  'contacts:write',
  'legal:read',
  'routines:read',
  'routines:write',
  'licensing:read',
  'licensing:write',
  'incidents:read',
  'incidents:write',
  'behaviorLogs:read',
  'behaviorLogs:write',
  'inventory:read',
  'inventory:write',
  'communications:read',
  'communications:write',
  'journal:read',
  'journal:write',
  'court:read',
  'court:write',
  'education:read',
  'education:write',
  'medical:read',
  'medical:write',
  'training:read',
  'training:write',
  'goals:read',
  'messages:read',
  'messages:write',
];

const CO_PARENT_CAPS: Capability[] = [
  'children:read',
  'children:write',
  'appointments:read',
  'appointments:write',
  'documents:read',
  'documents:write',
  'careLogs:read',
  'careLogs:write',
  'medications:read',
  'medications:write',
  'expenses:read',
  'expenses:write',
  'contacts:read',
  'contacts:write',
  'legal:read',
  'routines:read',
  'routines:write',
  'licensing:read',
  'licensing:write',
  'incidents:read',
  'incidents:write',
  'behaviorLogs:read',
  'behaviorLogs:write',
  'inventory:read',
  'inventory:write',
  'communications:read',
  'communications:write',
  'journal:read',
  'journal:write',
  'court:read',
  'court:write',
  'education:read',
  'education:write',
  'medical:read',
  'medical:write',
  'training:read',
  'training:write',
  'goals:read',
  'messages:read',
  'messages:write',
];

// Babysitter / respite: limited care instructions only. No documents, no legal,
// no expenses, no licensing, read-only. May see health info (meds + immunizations)
// but NOT court/legal records.
const BABYSITTER_CAPS: Capability[] = [
  'children:read',
  'careLogs:read',
  'medications:read',
  'medical:read',
  'routines:read',
  'contacts:read',
];

const ROLE_CAPS: Record<HouseholdRole, Set<Capability>> = {
  FOSTER_PARENT: new Set(FOSTER_PARENT_CAPS),
  CO_PARENT: new Set(CO_PARENT_CAPS),
  BABYSITTER: new Set(BABYSITTER_CAPS),
};

interface GranularPermissions {
  allow?: Capability[];
  deny?: Capability[];
}

export interface HouseholdContext {
  userId: string;
  globalRole: 'USER' | 'ADMIN';
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  permissions: GranularPermissions;
  tier: PlanTier;
  subscription: Subscription | null;
}

/** True if a household member may perform the capability. */
export function can(ctx: Pick<HouseholdContext, 'role' | 'permissions'>, cap: Capability): boolean {
  if (ctx.permissions.deny?.includes(cap)) return false;
  if (ROLE_CAPS[ctx.role].has(cap)) return true;
  if (ctx.permissions.allow?.includes(cap)) return true;
  return false;
}

/**
 * Resolve the signed-in user or throw 401. The role and active status are read
 * fresh from the database on every call (not trusted from the 8h JWT), so a
 * demoted, deactivated, or locked account loses access immediately rather than
 * at token expiry. Middleware is only a fast pre-filter; this is authoritative.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw Errors.unauthorized();
  const sid = session.user.sid;
  const [user, sess] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, email: true, name: true, globalRole: true, adminRole: true,
        isActive: true, isBanned: true, tokenVersion: true, emailVerifiedAt: true,
        deletedAt: true,
      },
    }),
    sid
      ? prisma.userSession.findUnique({
          where: { id: sid },
          select: { id: true, userId: true, revokedAt: true, lastSeenAt: true },
        })
      : Promise.resolve(null),
  ]);
  // A soft-deleted, deactivated, or banned account loses access immediately.
  if (!user || !user.isActive || user.isBanned || user.deletedAt) throw Errors.unauthorized();
  // Forced logout: a password reset or admin "sign out everywhere" bumps the
  // user's tokenVersion, instantly invalidating every previously issued JWT.
  if ((session.user.tokenVersion ?? 0) !== user.tokenVersion) throw Errors.unauthorized();
  // Per-device revocation: if this token names a session row, it must exist,
  // belong to the user, and not be revoked. Tokens issued before this feature
  // carry no sid and skip this check (still governed by tokenVersion above).
  if (sid) {
    if (!sess || sess.userId !== user.id || sess.revokedAt) throw Errors.unauthorized();
    // Throttle lastSeen writes to at most once / 5 min (cheap liveness signal).
    if (Date.now() - sess.lastSeenAt.getTime() > 5 * 60_000) {
      prisma.userSession.update({ where: { id: sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
    }
  }
  return {
    id: user.id, email: user.email, name: user.name, role: user.globalRole,
    adminRole: user.adminRole, emailVerifiedAt: user.emailVerifiedAt,
    sessionId: sid,
  };
}

/** Effective billing tier — GRACE keeps access, UNPAID/CANCELED drop to FREE. */
export function effectiveTier(sub: Pick<Subscription, 'status' | 'tier'> | null): PlanTier {
  if (!sub) return 'FREE';
  switch (sub.status) {
    case 'ACTIVE':
    case 'TRIALING':
    case 'GRACE':
    case 'PAST_DUE':
      return sub.tier;
    case 'CANCELED':
    case 'UNPAID':
    case 'INCOMPLETE':
    default:
      return 'FREE';
  }
}

const TIER_RANK: Record<PlanTier, number> = { FREE: 0, FAMILY: 1, PRO: 2, AGENCY: 3 };

/** Highest tier among a set (used for agency multi-home: the owner's best plan). */
export function bestTier(tiers: PlanTier[]): PlanTier {
  return tiers.reduce<PlanTier>((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best), 'FREE');
}

/**
 * Resolve the user's active household context. Uses the `fc_household` cookie if
 * it points at a household the user belongs to, otherwise the first membership.
 */
export async function requireHousehold(explicitId?: string): Promise<HouseholdContext> {
  const user = await requireUser();
  const cookieId = cookies().get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const wantedId = explicitId ?? cookieId ?? undefined;

  // The home OWNER's plan governs all their homes: an AGENCY plan on any one home
  // grants agency features to every home they own (and cancelling cleanly reverts
  // them). So we resolve the tier from the owner's best active subscription, not
  // just this home's own subscription.
  const include = {
    household: {
      include: {
        subscription: true,
        owner: {
          select: {
            ownedHouseholds: { select: { subscription: { select: { tier: true, status: true } } } },
          },
        },
      },
    },
  } satisfies Prisma.HouseholdMemberInclude;

  let membership = await prisma.householdMember.findFirst({
    where: { userId: user.id, ...(wantedId ? { householdId: wantedId } : {}) },
    include,
    orderBy: { invitedAt: 'asc' },
  });

  // A stale `fc_household` cookie can point at a household this user doesn't belong
  // to — e.g. left over after signing out and signing back in as a DIFFERENT user
  // on the same browser. Treat the cookie as a hint: if it doesn't resolve, fall
  // back to the user's first home. An EXPLICIT id (an API asking for a specific
  // household) must still 403 — that's IDOR protection, not a stale hint.
  if (!membership && !explicitId && cookieId) {
    membership = await prisma.householdMember.findFirst({
      where: { userId: user.id },
      include,
      orderBy: { invitedAt: 'asc' },
    });
  }

  if (!membership) {
    if (explicitId) throw Errors.forbidden();
    throw Errors.notFound();
  }

  const sub = membership.household.subscription;
  const ownerHomeSubs = membership.household.owner?.ownedHouseholds.map((h) => h.subscription) ?? [];
  const tier = bestTier([sub, ...ownerHomeSubs].map(effectiveTier));
  return {
    userId: user.id,
    globalRole: user.role,
    householdId: membership.householdId,
    householdName: membership.household.name,
    role: membership.role,
    permissions: (membership.permissions as GranularPermissions) ?? {},
    tier,
    subscription: sub,
  };
}

/** Throw 403 unless the context grants the capability. */
export function requireCapability(ctx: HouseholdContext, cap: Capability): void {
  if (!can(ctx, cap)) throw Errors.forbidden();
}

/** Throw 402 unless the household's plan includes the feature. */
export function requireFeature(ctx: HouseholdContext, feature: FeatureKey): void {
  if (!planHasFeature(ctx.tier, feature)) throw Errors.payment();
}

/** Require a global admin (for /admin routes). */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw Errors.forbidden();
  return user;
}

/** Require a specific granular admin permission (lib/admin.ts). */
export async function requireAdminPermission(perm: AdminPermission) {
  const user = await requireAdmin();
  if (!adminCan(user.adminRole, perm)) throw Errors.forbidden();
  return user;
}

/**
 * Babysitters must not see legal/court info or case identifiers. This strips
 * sensitive fields from a child record for limited caregivers.
 */
export function sanitizeChildForRole<T extends Record<string, unknown>>(
  child: T,
  role: HouseholdRole,
): T {
  if (role !== 'BABYSITTER') return child;
  const clone = { ...child } as Record<string, unknown>;
  for (const f of ['caseNumber', 'caseworkerName', 'importantNotes']) delete clone[f];
  return clone as T;
}
