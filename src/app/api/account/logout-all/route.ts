import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * "Sign out of all devices": bump tokenVersion so every previously issued JWT
 * (including the current one) fails the requireUser() check on its next request.
 * The client should clear its own cookie afterwards (next-auth signOut).
 */
export function POST() {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('logout-all', user.id, RateLimits.write);
    await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
    await logSecurity({ actorId: user.id, event: 'SESSIONS_REVOKED' });
    return json({ ok: true });
  });
}
