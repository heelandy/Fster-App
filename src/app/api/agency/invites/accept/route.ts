import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { logSecurity } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ token: z.string().min(10).max(200) });

/**
 * Accept an agency staff invite. The signed-in user's email must match the address
 * the invite was sent to (a leaked link can't be redeemed by a different account),
 * and the user must not already belong to another agency.
 */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('agency-invite-accept', user.id, RateLimits.write);
    const { token } = await readJson(req, schema);

    const invite = await prisma.agencyInvite.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw Errors.badRequest('This invitation is invalid or has expired.');
    }
    if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
      throw Errors.forbidden();
    }

    const elsewhere = await prisma.agencyMember.findFirst({ where: { userId: user.id } });
    if (elsewhere && elsewhere.agencyId !== invite.agencyId) {
      throw Errors.conflict('You already belong to another agency.');
    }

    await prisma.$transaction(async (tx) => {
      if (!elsewhere) {
        await tx.agencyMember.create({ data: { agencyId: invite.agencyId, userId: user.id, role: invite.role } });
      }
      await tx.agencyInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    });

    await logSecurity({ actorId: user.id, event: 'AGENCY_STAFF_INVITE_ACCEPTED', metadata: { agencyId: invite.agencyId } });
    return json({ ok: true, agencyId: invite.agencyId });
  });
}
