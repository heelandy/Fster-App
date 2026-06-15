import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, sanitizeChildForRole } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { childSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

async function loadChild(householdId: string, id: string) {
  const child = await prisma.childProfile.findFirst({ where: { id, householdId } });
  if (!child) throw Errors.notFound();
  return child;
}

export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:read');
    const child = await loadChild(ctx.householdId, params.id);
    return json(sanitizeChildForRole(child, ctx.role));
  });
}

export function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:write');
    mutationGuard('children', ctx.userId, RateLimits.write);
    await loadChild(ctx.householdId, params.id);
    const data = await readJson(req, childSchema.partial());
    const child = await prisma.childProfile.update({ where: { id: params.id }, data });
    return json(child);
  });
}

export function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'children:write');
    mutationGuard('children', ctx.userId, RateLimits.write);
    await loadChild(ctx.householdId, params.id);
    await prisma.childProfile.delete({ where: { id: params.id } });
    return json({ ok: true });
  });
}
