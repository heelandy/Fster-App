import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { checklistSchema } from '@/lib/validation';
import { assertChildInHousehold } from '@/lib/scope';
import { withinLimit, planLimit } from '@/lib/plans';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function GET(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:read');
    const childId = new URL(req.url).searchParams.get('childId');
    const checklists = await prisma.checklist.findMany({
      where: { householdId: ctx.householdId, ...(childId ? { childId } : {}) },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return json(checklists);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'routines:write');
    mutationGuard('checklists', ctx.userId, RateLimits.write);

    const count = await prisma.checklist.count({ where: { householdId: ctx.householdId } });
    if (!withinLimit(ctx.tier, 'maxChecklists', count)) {
      throw Errors.payment(
        `Your ${ctx.tier} plan allows up to ${planLimit(ctx.tier, 'maxChecklists')} checklist(s). Upgrade for more.`,
      );
    }

    const { items, childId, ...data } = await readJson(req, checklistSchema);
    if (childId) await assertChildInHousehold(ctx, childId);
    const checklist = await prisma.checklist.create({
      data: {
        ...data,
        householdId: ctx.householdId,
        childId: childId ?? null,
        items: items?.length ? { create: items.map((title, i) => ({ title, order: i })) } : undefined,
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    return json(checklist, 201);
  });
}
