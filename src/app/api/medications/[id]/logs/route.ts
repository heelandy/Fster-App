import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, requireFeature } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { medicationLogSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';
type Params = { params: { id: string } };

async function loadMedication(householdId: string, id: string) {
  const med = await prisma.medication.findFirst({ where: { id, householdId }, select: { id: true } });
  if (!med) throw Errors.notFound();
  return med;
}

export function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'medications:read');
    requireFeature(ctx, 'medications');
    await loadMedication(ctx.householdId, params.id);
    const logs = await prisma.medicationLog.findMany({
      where: { medicationId: params.id },
      orderBy: { givenAt: 'desc' },
      take: 100,
    });
    return json(logs);
  });
}

export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'medications:write');
    requireFeature(ctx, 'medications');
    mutationGuard('med-logs', ctx.userId, RateLimits.write);
    await loadMedication(ctx.householdId, params.id);
    const data = await readJson(req, medicationLogSchema);
    const log = await prisma.medicationLog.create({
      data: { ...data, medicationId: params.id, givenById: ctx.userId },
    });
    return json(log, 201);
  });
}
