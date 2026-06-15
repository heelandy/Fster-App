import { prisma } from './prisma';
import { Errors } from './http';
import type { HouseholdContext } from './authz';

/**
 * Verify a referenced child belongs to the caller's household. Returns the child
 * id only if valid, otherwise throws 404/403. This is the guard that stops a user
 * from attaching records to a child in another household (IDOR).
 */
export async function assertChildInHousehold(ctx: HouseholdContext, childId: string): Promise<string> {
  const child = await prisma.childProfile.findFirst({
    where: { id: childId, householdId: ctx.householdId },
    select: { id: true },
  });
  if (!child) throw Errors.notFound();
  return child.id;
}
