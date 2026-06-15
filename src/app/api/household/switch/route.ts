import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { ACTIVE_HOUSEHOLD_COOKIE } from '@/lib/authz';
import { handle, json, Errors } from '@/lib/http';
import { readJson, mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Switch the active household (agency / multi-home users). The cookie is only set
// after verifying the user is actually a member of the target household.
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('hh-switch', user.id, RateLimits.write);
    const { householdId } = await readJson(req, z.object({ householdId: z.string().cuid() }));

    const membership = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: user.id } },
      select: { id: true },
    });
    if (!membership) throw Errors.forbidden();

    cookies().set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return json({ ok: true });
  });
}
