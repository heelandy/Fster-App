import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { toggleSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:write');
    mutationGuard('checklist-items', ctx.userId, RateLimits.write);
    const itemRow = await prisma.checklistItem.findFirst({
      where: { id: params.id, checklist: { householdId: ctx.householdId } },
      select: { id: true },
    });
    if (!itemRow) throw Errors.notFound();
    const { isDone } = await readJson(req, toggleSchema);
    const updated = await prisma.checklistItem.update({
      where: { id: params.id },
      data: { isDone, doneAt: isDone ? new Date() : null },
    });
    return json(updated);
  });
}
