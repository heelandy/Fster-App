import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:write');
    mutationGuard('routines', ctx.userId, RateLimits.write);
    const routine = await prisma.routine.findFirst({
      where: { id: params.id, householdId: ctx.householdId },
      select: { id: true },
    });
    if (!routine) throw Errors.notFound();
    await prisma.routine.delete({ where: { id: params.id } });
    return json({ ok: true });
  });
}
