import { requireHousehold, can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { MembersClient } from '@/components/members-client';
import { AccessDenied } from '@/components/feature-locked';

export default async function HouseholdPage() {
  const ctx = await requireHousehold();
  if (!can(ctx, 'members:manage')) return <AccessDenied />;
  const household = await prisma.household.findUnique({
    where: { id: ctx.householdId },
    select: { ownerId: true },
  });
  return <MembersClient ownerId={household?.ownerId ?? ''} />;
}
