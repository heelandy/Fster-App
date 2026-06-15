import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'members:manage');
    mutationGuard('members', ctx.userId, RateLimits.write);

    const member = await prisma.householdMember.findFirst({
      where: { id: params.id, householdId: ctx.householdId },
      include: { household: { select: { ownerId: true } } },
    });
    if (!member) throw Errors.notFound();
    // The household owner (foster parent) cannot be removed.
    if (member.userId === member.household.ownerId) {
      throw Errors.badRequest('The household owner cannot be removed.');
    }

    await prisma.householdMember.delete({ where: { id: member.id } });
    await logAdmin({ actorId: ctx.userId, action: 'MEMBER_REMOVED', targetType: 'HouseholdMember', targetId: member.id });
    return json({ ok: true });
  });
}
