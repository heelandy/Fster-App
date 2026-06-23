import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Oversight requests this agency has sent that are not yet linked — PENDING (waiting
 * on the foster parent) or DENIED. Approved requests become linked homes and show in
 * the homes list instead. Lets staff see the progress of an oversight request.
 */
export function GET() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'homes:view');

    const requests = await prisma.agencyOversightRequest.findMany({
      where: { agencyId: ctx.agencyId, status: { in: ['PENDING', 'DENIED'] } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        household: { select: { name: true, owner: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return json(
      requests.map((r) => ({
        id: r.id,
        status: r.status,
        homeName: r.household.name,
        ownerName: r.household.owner.name,
        ownerEmail: r.household.owner.email,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  });
}
