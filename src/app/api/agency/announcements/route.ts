import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { announcementSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Announcements the agency has broadcast to its homes. */
export function GET() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    const announcements = await prisma.announcement.findMany({
      where: { agencyId: ctx.agencyId },
      select: { id: true, title: true, body: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return json(announcements);
  });
}

/** Broadcast a new announcement to the agency's foster homes (admin only). */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'announcements:manage');
    mutationGuard('agency-announcement', ctx.userId, RateLimits.write);
    const { title, body } = await readJson(req, announcementSchema);

    const a = await prisma.announcement.create({
      data: { agencyId: ctx.agencyId, title, body: body ?? null, createdById: ctx.userId },
      select: { id: true, title: true, createdAt: true },
    });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_ANNOUNCEMENT', metadata: { agencyId: ctx.agencyId, announcementId: a.id } });
    return json(a, 201);
  });
}
