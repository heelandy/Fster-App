import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

/** Revoke a pending invite. Scoped to the active household (IDOR-safe). */
export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'members:manage');
    mutationGuard('invites', ctx.userId, RateLimits.write);

    const invite = await prisma.householdInvite.findFirst({
      where: { id: params.id, householdId: ctx.householdId },
      select: { id: true },
    });
    if (!invite) throw Errors.notFound();

    await prisma.householdInvite.delete({ where: { id: invite.id } });
    await logAdmin({ actorId: ctx.userId, action: 'INVITE_REVOKED', targetType: 'HouseholdInvite', targetId: invite.id });
    return json({ ok: true });
  });
}
