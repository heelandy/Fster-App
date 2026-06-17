import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireUser, requireHousehold, requireCapability, requireFeature, ACTIVE_HOUSEHOLD_COOKIE } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { householdSchema } from '@/lib/validation';
import { planLimit, withinLimit } from '@/lib/plans';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // per-user, per-request

/** List the homes the signed-in user belongs to (for the switcher / agency view). */
export function GET() {
  return handle(async () => {
    const user = await requireUser();
    const active = cookies().get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
    const memberships = await prisma.householdMember.findMany({
      where: { userId: user.id },
      select: { role: true, household: { select: { id: true, name: true, ownerId: true } } },
      orderBy: { invitedAt: 'asc' },
    });
    return json(
      memberships.map((m) => ({
        id: m.household.id,
        name: m.household.name,
        role: m.role,
        isOwner: m.household.ownerId === user.id,
        current: m.household.id === active,
      })),
    );
  });
}

/**
 * Create a new foster home (agency multi-home). Gated by the `multiHome` feature
 * (AGENCY plan) and the plan's `maxHouseholds` limit, counted over homes the user
 * OWNS. The new home gets its own FREE subscription; agency-level features come
 * from the owner's AGENCY plan via the agency-aware effective tier (see authz).
 */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'household:manage');
    requireFeature(ctx, 'multiHome');
    mutationGuard('hh-create', ctx.userId, RateLimits.write);

    const { name } = await readJson(req, householdSchema);

    const ownedCount = await prisma.household.count({ where: { ownerId: ctx.userId } });
    if (!withinLimit(ctx.tier, 'maxHouseholds', ownedCount)) {
      throw Errors.payment(`Your plan allows up to ${planLimit(ctx.tier, 'maxHouseholds')} foster home(s).`);
    }

    const home = await prisma.$transaction(async (tx) => {
      const h = await tx.household.create({ data: { name, ownerId: ctx.userId } });
      await tx.householdMember.create({
        data: { householdId: h.id, userId: ctx.userId, role: 'FOSTER_PARENT', acceptedAt: new Date() },
      });
      await tx.subscription.create({ data: { householdId: h.id, tier: 'FREE', status: 'ACTIVE' } });
      return h;
    });

    return json({ id: home.id, name: home.name }, 201);
  });
}
