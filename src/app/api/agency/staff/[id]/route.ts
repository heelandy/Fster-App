import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/** Remove a staff member from the agency. Agency-admin only; can't remove yourself. */
export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'staff:manage');
    mutationGuard('agency-staff', ctx.userId, RateLimits.write);

    const member = await prisma.agencyMember.findUnique({
      where: { id: params.id },
      select: { id: true, agencyId: true, userId: true },
    });
    if (!member || member.agencyId !== ctx.agencyId) throw Errors.notFound();
    if (member.userId === ctx.userId) throw Errors.badRequest('You cannot remove yourself.');

    await prisma.agencyMember.delete({ where: { id: params.id } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_STAFF_REMOVED', metadata: { agencyId: ctx.agencyId, memberId: params.id } });
    return json({ ok: true });
  });
}
