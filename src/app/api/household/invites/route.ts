import { prisma } from '@/lib/prisma';
import { requireHousehold, requireCapability, requireFeature } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { inviteMemberSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';
import { generateToken } from '@/lib/tokens';
import { sendInvite } from '@/lib/email';
import { logAdmin } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // auth-gated, per-request — never prerender

const EXPIRY_MS = 7 * 86_400_000; // 7 days

/** List pending (unaccepted, unexpired) invites for the active household. */
export function GET() {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'members:manage');
    const invites = await prisma.householdInvite.findMany({
      where: { householdId: ctx.householdId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    });
    return json(invites);
  });
}

/**
 * Invite by email. If the address already has an account, add them to the
 * household immediately; otherwise create a tokenised invite and email a link.
 */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireHousehold();
    requireCapability(ctx, 'members:manage');
    mutationGuard('invites', ctx.userId, RateLimits.write);

    const data = await readJson(req, inviteMemberSchema);
    if (data.role === 'CO_PARENT') requireFeature(ctx, 'coParentAccess');
    if (data.role === 'BABYSITTER') requireFeature(ctx, 'babysitterMode');

    const email = data.email;
    const permissions = data.deny?.length ? { deny: data.deny } : {};

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      const already = await prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId: ctx.householdId, userId: existingUser.id } },
      });
      if (already) throw Errors.conflict('That person is already a member of this household.');
      const member = await prisma.householdMember.create({
        data: {
          householdId: ctx.householdId,
          userId: existingUser.id,
          role: data.role,
          permissions,
          acceptedAt: new Date(),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      await logAdmin({ actorId: ctx.userId, action: 'MEMBER_ADDED', targetType: 'HouseholdMember', targetId: member.id, metadata: { role: data.role } });
      return json({ added: true, member }, 201);
    }

    // No account yet — create a tokenised email invite.
    const { raw, hash } = generateToken();
    await prisma.householdInvite.deleteMany({ where: { householdId: ctx.householdId, email, acceptedAt: null } });
    const invite = await prisma.householdInvite.create({
      data: {
        householdId: ctx.householdId,
        email,
        role: data.role,
        permissions,
        tokenHash: hash,
        invitedById: ctx.userId,
        expiresAt: new Date(Date.now() + EXPIRY_MS),
      },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    });
    await sendInvite(email, ctx.householdName, `${env.APP_URL}/invite?token=${raw}`);
    await logAdmin({ actorId: ctx.userId, action: 'INVITE_SENT', targetType: 'HouseholdInvite', targetId: invite.id, metadata: { role: data.role } });
    return json({ invited: true, invite }, 201);
  });
}
