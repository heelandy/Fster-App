import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { messageSchema } from '@/lib/validation';

export const runtime = 'nodejs';

/** The foster parent's secure message thread with their agency. */
export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'messages:read');
    const messages = await prisma.message.findMany({
      where: { householdId: ctx.householdId },
      select: { id: true, body: true, fromAgency: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return json(messages);
  });
}

/** Foster parent sends a message to their agency. */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'messages:write');
    mutationGuard('messages', ctx.userId, RateLimits.write);
    const { body } = await readJson(req, messageSchema);

    const home = await prisma.household.findUnique({ where: { id: ctx.householdId }, select: { agencyId: true } });
    if (!home?.agencyId) throw Errors.badRequest('Your home is not linked to an agency.');

    const msg = await prisma.message.create({
      data: { householdId: ctx.householdId, agencyId: home.agencyId, senderId: ctx.userId, fromAgency: false, body },
      select: { id: true, body: true, fromAgency: true, createdAt: true },
    });
    return json(msg, 201);
  });
}
