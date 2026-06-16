import { prisma } from '@/lib/prisma';
import { handle, json, Errors } from '@/lib/http';
import { hashToken } from '@/lib/tokens';
import { enforceRateLimit, enforceDistributedLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Public lookup of an invite by its raw token. Returns only the minimum needed
 * to render the accept screen (household name, target email, role). No auth — the
 * token itself is the capability — so it is per-IP rate limited to blunt token
 * guessing / invite enumeration.
 */
export function GET(_req: Request, { params }: { params: { token: string } }) {
  return handle(async () => {
    const ip = getClientInfo().ip;
    enforceRateLimit(`invite-lookup:${ip}`, RateLimits.auth);
    await enforceDistributedLimit(`invite-lookup:${ip}`, RateLimits.auth);

    const invite = await prisma.householdInvite.findUnique({
      where: { tokenHash: hashToken(params.token) },
      select: {
        email: true, role: true, acceptedAt: true, expiresAt: true,
        household: { select: { name: true } },
      },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw Errors.notFound();
    }
    return json({ email: invite.email, role: invite.role, householdName: invite.household.name });
  });
}
