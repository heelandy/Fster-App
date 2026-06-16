import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { logAdmin } from '@/lib/audit';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ token: z.string().min(10).max(200) });

/**
 * Accept a household invite. The signed-in user's email must match the address
 * the invite was sent to — this stops a leaked link from being redeemed by a
 * different account.
 */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('invite-accept', user.id, RateLimits.write);
    const { token } = await readJson(req, schema);

    const invite = await prisma.householdInvite.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw Errors.badRequest('This invitation is invalid or has expired.');
    }
    if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
      throw Errors.forbidden();
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.householdMember.findUnique({
        where: { householdId_userId: { householdId: invite.householdId, userId: user.id } },
      });
      if (!existing) {
        await tx.householdMember.create({
          data: {
            householdId: invite.householdId,
            userId: user.id,
            role: invite.role,
            permissions: invite.permissions as object,
            acceptedAt: new Date(),
          },
        });
      }
      await tx.householdInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    });

    await logAdmin({ actorId: user.id, action: 'INVITE_ACCEPTED', targetType: 'HouseholdInvite', targetId: invite.id });
    return json({ ok: true, householdId: invite.householdId });
  });
}
