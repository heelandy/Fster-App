import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, sanitizeChildForRole } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { childSchema } from '@/lib/validation';
import { withinLimit, planLimit } from '@/lib/plans';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:read');
    const children = await prisma.childProfile.findMany({
      where: { householdId: ctx.householdId },
      orderBy: { createdAt: 'desc' },
    });
    return json(children.map((c) => sanitizeChildForRole(c, ctx.role)));
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:write');
    mutationGuard('children', ctx.userId, RateLimits.write);

    const count = await prisma.childProfile.count({ where: { householdId: ctx.householdId } });
    if (!withinLimit(ctx.tier, 'maxChildren', count)) {
      throw Errors.payment(
        `Your ${ctx.tier} plan allows up to ${planLimit(ctx.tier, 'maxChildren')} child profile(s). Upgrade to add more.`,
      );
    }

    const data = await readJson(req, childSchema);
    const child = await prisma.childProfile.create({
      data: { ...data, householdId: ctx.householdId },
    });
    return json(child, 201);
  });
}
