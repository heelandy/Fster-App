import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability, requireAgencyHome } from '@/lib/agency';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { messageSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Params = { params: { id: string } };

/** The agency's secure message thread with one of its foster homes. */
export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'messages:manage');
    const home = await requireAgencyHome(ctx, params.id);
    const messages = await prisma.message.findMany({
      where: { householdId: home.id },
      select: { id: true, body: true, fromAgency: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return json(messages);
  });
}

/** Agency sends a message to a foster home. */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'messages:manage');
    mutationGuard('agency-message', ctx.userId, RateLimits.write);
    const home = await requireAgencyHome(ctx, params.id);
    const { body } = await readJson(req, messageSchema);

    const msg = await prisma.message.create({
      data: { householdId: home.id, agencyId: ctx.agencyId, senderId: ctx.userId, fromAgency: true, body },
      select: { id: true, body: true, fromAgency: true, createdAt: true },
    });
    return json(msg, 201);
  });
}
