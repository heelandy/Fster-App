import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { routineSchema } from '@/lib/validation';
import { assertChildInHousehold } from '@/lib/scope';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function GET(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:read');
    const childId = new URL(req.url).searchParams.get('childId');
    const routines = await prisma.routine.findMany({
      where: { householdId: ctx.householdId, ...(childId ? { childId } : {}) },
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return json(routines);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:write');
    mutationGuard('routines', ctx.userId, RateLimits.write);
    const { tasks, childId, ...data } = await readJson(req, routineSchema);
    if (childId) await assertChildInHousehold(ctx, childId);
    const routine = await prisma.routine.create({
      data: {
        ...data,
        householdId: ctx.householdId,
        childId: childId ?? null,
        tasks: tasks?.length
          ? { create: tasks.map((title, i) => ({ title, order: i })) }
          : undefined,
      },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
    return json(routine, 201);
  });
}
