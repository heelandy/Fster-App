import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { handle, json } from '@/lib/http';
import { mutationGuard } from '@/lib/api';
import { RateLimits } from '@/lib/rate-limit';
import { issueEmailVerification } from '@/lib/email-verification';

export const runtime = 'nodejs';

/** Resend the verification email for the signed-in (still-unverified) user. */
export function POST() {
  return handle(async () => {
    const user = await requireUser();
    mutationGuard('resend-verification', user.id, RateLimits.auth);

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true, email: true } });
    if (row && !row.emailVerifiedAt) {
      await issueEmailVerification(user.id, row.email);
    }
    // Always report success (no information leak about verification state).
    return json({ ok: true });
  });
}
