import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyStaffSchema } from '@/lib/validation';
import { generateToken } from '@/lib/tokens';
import { sendAgencyInvite } from '@/lib/email';
import { logSecurity } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVITE_EXPIRY_MS = 7 * 86_400_000; // 7 days

/** List the agency's staff. Agency-admin only — case workers don't see staff. */
export function GET() {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'staff:manage');
    const members = await prisma.agencyMember.findMany({
      where: { agencyId: ctx.agencyId },
      select: { id: true, role: true, createdAt: true, userId: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return json(
      members.map((m) => ({
        id: m.id,
        role: m.role,
        name: m.user.name,
        email: m.user.email,
        isYou: m.userId === ctx.userId,
        createdAt: m.createdAt,
      })),
    );
  });
}

/**
 * Invite a staff member by email. If the address already has an account, add them
 * to the agency immediately; otherwise create a tokenised invite and email a link.
 * Agency-admin only.
 */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'staff:manage');
    mutationGuard('agency-staff', ctx.userId, RateLimits.write);
    const { email, role } = await readJson(req, agencyStaffSchema);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const elsewhere = await prisma.agencyMember.findFirst({ where: { userId: user.id } });
      if (elsewhere) {
        throw Errors.conflict(elsewhere.agencyId === ctx.agencyId ? 'They are already on your staff.' : 'That user already belongs to another agency.');
      }
      const member = await prisma.agencyMember.create({ data: { agencyId: ctx.agencyId, userId: user.id, role } });
      await logSecurity({ actorId: ctx.userId, event: 'AGENCY_STAFF_ADDED', metadata: { agencyId: ctx.agencyId, email, role } });
      return json({ added: true, id: member.id }, 201);
    }

    // No account yet — create a tokenised email invite (mirrors household invites).
    const { raw, hash } = generateToken();
    await prisma.agencyInvite.deleteMany({ where: { agencyId: ctx.agencyId, email, acceptedAt: null } });
    const invite = await prisma.agencyInvite.create({
      data: {
        agencyId: ctx.agencyId,
        email,
        role,
        tokenHash: hash,
        invitedById: ctx.userId,
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
      },
      select: { id: true },
    });
    await sendAgencyInvite(email, ctx.agencyName, `${env.APP_URL}/agency-invite?token=${raw}`);
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_STAFF_INVITED', metadata: { agencyId: ctx.agencyId, email, role } });
    return json({ invited: true, id: invite.id }, 201);
  });
}
