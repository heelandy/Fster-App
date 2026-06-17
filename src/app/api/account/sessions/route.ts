import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // per-user, per-request — never prerender

// JWT maxAge is 8h; a session not seen within that window is effectively dead
// (its token has expired), so it's hidden from the list to avoid clutter.
const ACTIVE_WINDOW_MS = 8 * 60 * 60 * 1000;

/** List the signed-in user's active device sessions (current one flagged). */
export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await prisma.userSession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        lastSeenAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
      },
      select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });
    return json(
      rows.map((r) => ({
        id: r.id,
        userAgent: r.userAgent,
        ip: r.ip,
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
        current: r.id === user.sessionId,
      })),
    );
  });
}
