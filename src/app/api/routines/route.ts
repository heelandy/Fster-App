import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { routineSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:read');
    const routines = await prisma.routine.findMany({
      where: { householdId: ctx.householdId },
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
    const { tasks, ...data } = await readJson(req, routineSchema);
    const routine = await prisma.routine.create({
      data: {
        ...data,
        householdId: ctx.householdId,
        tasks: tasks?.length
          ? { create: tasks.map((title, i) => ({ title, order: i })) }
          : undefined,
      },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
    return json(routine, 201);
  });
}
