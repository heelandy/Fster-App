import { prisma } from '@/lib/prisma';
import { requireAgencyMember, requireAgencyCapability } from '@/lib/agency';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { agencyStaffSchema } from '@/lib/validation';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

/** Add a staff member by email (must be an existing user). Agency-admin only. */
export function POST(req: Request) {
  return handle(async () => {
    const ctx = await requireAgencyMember();
    requireAgencyCapability(ctx, 'staff:manage');
    mutationGuard('agency-staff', ctx.userId, RateLimits.write);
    const { email, role } = await readJson(req, agencyStaffSchema);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw Errors.badRequest('No user with that email. They must create an account first.');

    const elsewhere = await prisma.agencyMember.findFirst({ where: { userId: user.id } });
    if (elsewhere) {
      throw Errors.conflict(elsewhere.agencyId === ctx.agencyId ? 'They are already on your staff.' : 'That user already belongs to another agency.');
    }

    const member = await prisma.agencyMember.create({ data: { agencyId: ctx.agencyId, userId: user.id, role } });
    await logSecurity({ actorId: ctx.userId, event: 'AGENCY_STAFF_ADDED', metadata: { agencyId: ctx.agencyId, email, role } });
    return json({ id: member.id }, 201);
  });
}
