import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

/**
 * Revoke a single device session. The token bound to it fails requireUser on its
 * next request. Scoped to the caller's own sessions (can't revoke others' rows).
 */
export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('sessions', user.id, RateLimits.write);
    const target = await prisma.userSession.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!target || target.userId !== user.id) throw Errors.notFound();
    if (!target.revokedAt) {
      await prisma.userSession.update({ where: { id: params.id }, data: { revokedAt: new Date() } });
      await logSecurity({ actorId: user.id, event: 'SESSION_REVOKED', metadata: { sessionId: params.id, self: params.id === user.sessionId } });
    }
    return json({ ok: true });
  });
}
