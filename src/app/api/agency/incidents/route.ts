import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Incidents across all homes the caller's agency oversees (case worker / admin). */
export function GET() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'incidents:manage');
    const incidents = await prisma.incident.findMany({
      where: { household: { agencyId: ctx.agencyId } },
      select: {
        id: true, title: true, description: true, severity: true, status: true, resolution: true, createdAt: true,
        household: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return json(incidents);
  });
}
