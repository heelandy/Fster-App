import { prisma } from '@/lib/prisma';
import { handle, json, Errors } from '@/lib/http';
import { readJson, enforceRateLimit, enforceDistributedLimit } from '@/lib/api';
import { getClientInfo } from '@/lib/request';
import { verifyEmailSchema } from '@/lib/validation';
import { RateLimits } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { logSecurity } from '@/lib/audit';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handle(async () => {
    const info = getClientInfo();
    enforceRateLimit(`verify-email:${info.ip}`, RateLimits.auth);
    await enforceDistributedLimit(`verify-email:${info.ip}`, RateLimits.auth);

    const { token } = await readJson(req, verifyEmailSchema);
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw Errors.badRequest('This verification link is invalid or has expired. Request a new one.');
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    await logSecurity({ actorId: record.userId, event: 'EMAIL_VERIFIED' });
    return json({ ok: true });
  });
}
