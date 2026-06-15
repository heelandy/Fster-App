import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { toggleSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

// Toggle a routine task complete. Verifies the task's routine is in the household.
export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:write');
    mutationGuard('routine-tasks', ctx.userId, RateLimits.write);
    const task = await prisma.routineTask.findFirst({
      where: { id: params.id, routine: { householdId: ctx.householdId } },
      select: { id: true },
    });
    if (!task) throw Errors.notFound();
    const { isDone } = await readJson(req, toggleSchema);
    const updated = await prisma.routineTask.update({ where: { id: params.id }, data: { isDone } });
    return json(updated);
  });
}
