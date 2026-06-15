import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, requireFeature } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { inviteMemberSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/audit';

export const runtime = 'nodejs';

export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'members:manage');
    const members = await prisma.householdMember.findMany({
      where: { householdId: ctx.householdId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { invitedAt: 'asc' },
    });
    return json(members);
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'members:manage');
    mutationGuard('members', ctx.userId, RateLimits.write);

    // Co-parent & babysitter access are paid features.
    const data = await readJson(req, inviteMemberSchema);
    if (data.role === 'CO_PARENT') requireFeature(ctx, 'coParentAccess');
    if (data.role === 'BABYSITTER') requireFeature(ctx, 'babysitterMode');

    const email = data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      // Generic message — do not disclose whether the email is registered.
      throw Errors.badRequest('That person needs to create an account first, then you can add them.');
    }

    const existing = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: ctx.householdId, userId: user.id } },
    });
    if (existing) throw Errors.conflict('That person is already a member of this household.');

    const member = await prisma.householdMember.create({
      data: {
        householdId: ctx.householdId,
        userId: user.id,
        role: data.role,
        permissions: data.deny?.length ? { deny: data.deny } : {},
        acceptedAt: new Date(),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await logAdmin({
      actorId: ctx.userId,
      action: 'MEMBER_ADDED',
      targetType: 'HouseholdMember',
      targetId: member.id,
      metadata: { role: data.role, household: ctx.householdId },
    });
    return json(member, 201);
  });
}
