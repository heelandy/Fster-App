import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { planHasFeature, planLimit } from '@/lib/plans';
import { AgencyClient } from '@/components/agency-client';
import { FeatureLocked } from '@/components/feature-locked';

export default async function AgencyPage() {
  const ctx = await requireHousehold();
  // Agency dashboard is an owner tool on the AGENCY plan.
  if (!can(ctx, 'household:manage') || !planHasFeature(ctx.tier, 'agencyDashboard')) {
    return <FeatureLocked feature="the Agency dashboard (Agency / Multi-Home plan)" />;
  }

  // Only the homes this user belongs to — keeps the view scoped to their own data.
  const memberships = await prisma.householdMember.findMany({
    where: { userId: ctx.userId },
    select: { role: true, household: { select: { id: true, name: true, ownerId: true } } },
    orderBy: { invitedAt: 'asc' },
  });
  const ids = memberships.map((m) => m.household.id);
  const now = new Date();

  // Aggregate per-home metrics in three grouped queries (not N per home).
  const [children, appts, licensing] = await Promise.all([
    prisma.childProfile.groupBy({ by: ['householdId'], where: { householdId: { in: ids } }, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ['householdId'], where: { householdId: { in: ids }, startsAt: { gte: now } }, _count: { _all: true } }),
    prisma.licensingRequirement.groupBy({ by: ['householdId'], where: { householdId: { in: ids }, status: { in: ['DUE_SOON', 'EXPIRED'] } }, _count: { _all: true } }),
  ]);
  const cMap = Object.fromEntries(children.map((g) => [g.householdId, g._count._all]));
  const aMap = Object.fromEntries(appts.map((g) => [g.householdId, g._count._all]));
  const lMap = Object.fromEntries(licensing.map((g) => [g.householdId, g._count._all]));

  const homes = memberships.map((m) => ({
    id: m.household.id,
    name: m.household.name,
    role: m.role,
    isOwner: m.household.ownerId === ctx.userId,
    current: m.household.id === ctx.householdId,
    children: cMap[m.household.id] ?? 0,
    upcomingAppointments: aMap[m.household.id] ?? 0,
    complianceAlerts: lMap[m.household.id] ?? 0,
  }));

  const totals = {
    homes: homes.length,
    children: homes.reduce((s, h) => s + h.children, 0),
    upcomingAppointments: homes.reduce((s, h) => s + h.upcomingAppointments, 0),
    complianceAlerts: homes.reduce((s, h) => s + h.complianceAlerts, 0),
  };

  const maxHomes = planLimit(ctx.tier, 'maxHouseholds'); // -1 = unlimited
  const ownedCount = homes.filter((h) => h.isOwner).length;
  const canCreate = maxHomes === -1 || ownedCount < maxHomes;

  return <AgencyClient homes={homes} totals={totals} canCreate={canCreate} maxHomes={maxHomes} />;
}
